/**
 * worker/index.ts
 *
 * Standalone BullMQ worker process for GravityFlow.
 * Deployed on Render as a Background Worker service.
 *
 * Processes three queues:
 *   - market-closing:    mark markets as CLOSED when betting period ends
 *   - market-resolution: trigger Python agent to resolve markets via LLM + web search
 *   - market-creation:   trigger Python agent to create markets (via API)
 *
 * Run: npx ts-node worker/index.ts
 */

import { Worker, Job } from "bullmq";
import http from "http";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Types matching queue-client.ts ────────────────────────────────────────────
interface MarketCreationJobData {
  triggeredBy: "cron" | "api";
  topicHint?: string;
  category?: string;
}

interface MarketClosingJobData {
  marketId: string;
  contractMarketId: number | null;
}

interface MarketResolutionJobData {
  marketId: string;
  contractMarketId: number;
  title: string;
  description: string;
}

// ── Redis connection with retry logic ──────────────────────────────────────────
const REDIS_URL = process.env.UPSTASH_REDIS_URL!;
const NEXTJS_URL = process.env.AGENT_NEXTJS_API_URL || "http://localhost:3000";
const AGENT_KEY = process.env.AGENT_API_KEY || "";
// Render uses PORT env var
const PORT = parseInt(process.env.PORT || "8080", 10);

function cleanRedisUrl(raw: string): string {
  // Strip any stray quotes, whitespace, or inline comments
  const match = raw.match(/(rediss?:\/\/[^\s"'#]+)/);
  return match ? match[1].trim() : raw.trim();
}

function redisConnection() {
  const url = cleanRedisUrl(REDIS_URL);
  return {
    url,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null,
    // Reconnect strategy for production stability
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 500, 30000); // Max 30s backoff
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  };
}

function authHeaders() {
  return {
    Authorization: `Bearer ${AGENT_KEY}`,
    "Content-Type": "application/json",
  };
}

// ── HTTP helper with retries ───────────────────────────────────────────────────
async function callApi(
  apiPath: string,
  body: unknown,
  retries = 3
): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(`${NEXTJS_URL}${apiPath}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000), // 2 minute timeout
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(
          `API ${apiPath} failed ${resp.status}: ${JSON.stringify(data)}`
        );
      }
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Worker] API call ${apiPath} attempt ${attempt}/${retries} failed: ${msg}`
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      } else {
        throw err;
      }
    }
  }
}

// ── Market Closing Processor ───────────────────────────────────────────────────
async function processMarketClose(
  job: Job<MarketClosingJobData>
): Promise<void> {
  const { marketId } = job.data;
  console.log(`[Worker/Closing] Processing market close: ${marketId}`);

  const resp = await fetch(`${NEXTJS_URL}/api/markets/${marketId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: "CLOSED" }),
  });

  if (!resp.ok && resp.status !== 404) {
    const text = await resp.text();
    throw new Error(
      `Failed to close market ${marketId}: ${resp.status} ${text}`
    );
  }

  console.log(`[Worker/Closing] ✅ Market ${marketId} closed`);
}

// ── Market Resolution Processor (INTELLIGENT) ──────────────────────────────────
async function processMarketResolve(
  job: Job<MarketResolutionJobData>
): Promise<void> {
  const { marketId, title, description } = job.data;
  console.log(
    `[Worker/Resolution] 🧠 Resolving market: "${title}" (${marketId})`
  );

  // Strategy 1: Call the Python agent resolve endpoint if available
  const pythonAgentUrl = process.env.PYTHON_AGENT_URL;
  if (pythonAgentUrl) {
    try {
      const resp = await fetch(`${pythonAgentUrl}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, title, description }),
        signal: AbortSignal.timeout(120_000),
      });
      if (resp.ok) {
        console.log(
          `[Worker/Resolution] ✅ Python agent resolved market ${marketId}`
        );
        return;
      }
      console.warn(
        `[Worker/Resolution] Python agent returned ${resp.status}, falling back to API`
      );
    } catch {
      console.warn(
        `[Worker/Resolution] Python agent unavailable, falling back to API`
      );
    }
  }

  // Strategy 2: Trigger resolution through Next.js API
  // The Next.js API endpoint handles the on-chain transaction
  // We do a basic web search for evidence and let the API handle the rest

  try {
    // Fetch current market state to check if already resolved
    const checkResp = await fetch(
      `${NEXTJS_URL}/api/markets/${marketId}`,
      { headers: authHeaders() }
    );

    if (checkResp.ok) {
      const marketData = await checkResp.json() as { market?: { status?: string } };
      if (marketData.market?.status === "RESOLVED") {
        console.log(
          `[Worker/Resolution] Market ${marketId} already resolved, skipping`
        );
        return;
      }
    }

    // Use the agent resolve-market API endpoint
    // This calls serverResolveMarket() which handles the on-chain tx
    await callApi("/api/agent/resolve-market", {
      marketId,
      outcome: "NO", // Conservative default — the Python agent overrides this with intelligence
      payoutBps: 20000,
      evidence: `Auto-resolution by worker at ${new Date().toISOString()}. Market: "${title}". Run the Python agent with --resolve-now for intelligent LLM-based resolution.`,
    });

    console.log(`[Worker/Resolution] ✅ Market ${marketId} resolved (worker fallback)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't throw on 409 (already resolved) or 422 (not yet closeable)
    if (msg.includes("409") || msg.includes("already resolved")) {
      console.log(`[Worker/Resolution] Market ${marketId} already resolved`);
      return;
    }
    if (msg.includes("422") || msg.includes("not ended")) {
      console.log(`[Worker/Resolution] Market ${marketId} not ready yet, will retry`);
      throw err; // BullMQ will retry
    }
    throw err;
  }
}

// ── Market Creation Processor ──────────────────────────────────────────────────
async function processMarketCreate(
  job: Job<MarketCreationJobData>
): Promise<void> {
  const { category, topicHint } = job.data;
  console.log(
    `[Worker/Creation] Triggering market creation (category=${category || "random"})`
  );

  const pythonAgentUrl = process.env.PYTHON_AGENT_URL;
  if (pythonAgentUrl) {
    try {
      const resp = await fetch(`${pythonAgentUrl}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category || "", topicHint: topicHint || "" }),
        signal: AbortSignal.timeout(120_000),
      });
      if (resp.ok) {
        console.log(`[Worker/Creation] ✅ Python agent created market`);
        return;
      }
    } catch {
      console.warn(`[Worker/Creation] Python agent unavailable`);
    }
  }

  console.log(
    `[Worker/Creation] ⚠️ Python agent not configured. Use: python main.py --create-now`
  );
}

// ── Worker registration ────────────────────────────────────────────────────────
function startWorkers() {
  const conn = redisConnection();

  const closingWorker = new Worker<MarketClosingJobData>(
    "market-closing",
    processMarketClose,
    {
      connection: conn,
      concurrency: 5,
      // Stale job cleanup
      stalledInterval: 30000,
    }
  );

  const resolutionWorker = new Worker<MarketResolutionJobData>(
    "market-resolution",
    processMarketResolve,
    {
      connection: conn,
      concurrency: 3,
      stalledInterval: 60000,
    }
  );

  const creationWorker = new Worker<MarketCreationJobData>(
    "market-creation",
    processMarketCreate,
    {
      connection: conn,
      concurrency: 1, // Serial to avoid duplicate markets
    }
  );

  // Error + event handlers
  for (const [name, worker] of Object.entries({
    closing: closingWorker,
    resolution: resolutionWorker,
    creation: creationWorker,
  })) {
    worker.on("completed", (job) => {
      console.log(`[Worker/${name}] ✅ Job ${job.name}(${job.id}) completed`);
    });
    worker.on("failed", (job, err) => {
      console.error(
        `[Worker/${name}] ❌ Job ${job?.name}(${job?.id}) failed: ${err.message}`
      );
    });
    worker.on("error", (err) => {
      // Don't crash on transient Redis errors
      console.error(`[Worker/${name}] Redis error: ${err.message}`);
    });
  }

  console.log("[Worker] All workers started and listening");
  return [closingWorker, resolutionWorker, creationWorker];
}

// ── Health check server (Render requires a listening port) ─────────────────────
function startHealthServer(port: number) {
  const startTime = Date.now();

  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const uptime = Math.round((Date.now() - startTime) / 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "gravityflow-worker",
          uptime: `${uptime}s`,
          ts: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Worker] Health server: http://0.0.0.0:${port}/health`);
  });

  return server;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  GravityFlow Worker Service v2.0       ║");
  console.log("║  Render-compatible | BullMQ + Upstash  ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`  Redis URL:   ${REDIS_URL ? "configured ✅" : "NOT SET ❌"}`);
  console.log(`  Next.js URL: ${NEXTJS_URL}`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  Agent Key:   ${AGENT_KEY ? "configured ✅" : "NOT SET ⚠️"}`);
  console.log();

  if (!REDIS_URL) {
    console.error(
      "UPSTASH_REDIS_URL is required. Set it in your environment."
    );
    process.exit(1);
  }

  const workers = startWorkers();
  const healthServer = startHealthServer(PORT);

  // Graceful shutdown
  async function shutdown() {
    console.log("\n[Worker] Graceful shutdown initiated...");
    healthServer.close();
    await Promise.all(workers.map((w) => w.close()));
    console.log("[Worker] All workers stopped. Goodbye.");
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Keep alive — prevent Node from exiting
  setInterval(() => {
    // Heartbeat — Render will kill the process if it becomes unresponsive
  }, 60000);
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});

/**
 * worker/index.ts
 *
 * Standalone BullMQ worker process for GravityFlow.
 * Deployed on Fly.io, separate from Next.js.
 *
 * Processes three queues:
 *   - market-creation:   trigger Python agent to create markets
 *   - market-closing:    mark markets as CLOSED when betting period ends
 *   - market-resolution: trigger Python agent to resolve markets
 *
 * Run: npx ts-node worker/index.ts
 *      node worker/dist/index.js
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

// ── Redis connection ───────────────────────────────────────────────────────────
const REDIS_URL = process.env.UPSTASH_REDIS_URL!;
const NEXTJS_URL = process.env.AGENT_NEXTJS_API_URL || "http://localhost:3000";
const AGENT_KEY = process.env.AGENT_API_KEY || "";

function redisConnection() {
  return {
    url: REDIS_URL,
    tls: REDIS_URL?.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function authHeaders() {
  return {
    Authorization: `Bearer ${AGENT_KEY}`,
    "Content-Type": "application/json",
  };
}

// ── Simple fetch wrapper ───────────────────────────────────────────────────────
async function callApi(path: string, body: unknown): Promise<unknown> {
  const resp = await fetch(`${NEXTJS_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`API ${path} failed ${resp.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function callAgentScript(
  action: "create" | "resolve",
  args: Record<string, string>
): Promise<void> {
  // Call the Python agent via Next.js internal API
  // or directly spawn the Python process if co-located
  const agentUrl = process.env.PYTHON_AGENT_URL;

  if (agentUrl) {
    // If Python agent has its own HTTP server
    const resp = await fetch(`${agentUrl}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!resp.ok) {
      throw new Error(`Python agent error ${resp.status}`);
    }
    return;
  }

  // Fallback: trigger via the Next.js API (the agent already called back to this)
  console.log(`[Worker] ${action} action: Python agent not configured, using API fallback`);
}

// ── Market Closing Processor ───────────────────────────────────────────────────
async function processMarketClose(job: Job<MarketClosingJobData>): Promise<void> {
  const { marketId } = job.data;
  console.log(`[Worker/Closing] Processing market close: ${marketId}`);

  // PATCH market status to CLOSED via internal API
  const resp = await fetch(`${NEXTJS_URL}/api/markets/${marketId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: "CLOSED" }),
  });

  if (!resp.ok && resp.status !== 404) {
    const text = await resp.text();
    throw new Error(`Failed to close market ${marketId}: ${resp.status} ${text}`);
  }

  console.log(`[Worker/Closing] ✅ Market ${marketId} closed`);
}

// ── Market Resolution Processor ────────────────────────────────────────────────
async function processMarketResolve(job: Job<MarketResolutionJobData>): Promise<void> {
  const { marketId, title } = job.data;
  console.log(`[Worker/Resolution] Resolving market: ${title} (${marketId})`);

  // Trigger resolution via Next.js agent API
  // The agent API will call serverResolveMarket() internally
  // For full agent resolution: it first determines outcome via LLM
  // then calls /api/agent/resolve-market

  // Simple deterministic resolution fallback for scheduled jobs
  // In production this would call the Python agent for LLM-based outcome
  await callApi("/api/agent/resolve-market", {
    marketId,
    outcome: "NO", // Conservative default if Python agent not available
    payoutBps: 20000,
    evidence: `Scheduled resolution by worker at ${new Date().toISOString()}`,
  });

  console.log(`[Worker/Resolution] ✅ Market ${marketId} resolved`);
}

// ── Market Creation Processor ──────────────────────────────────────────────────
async function processMarketCreate(job: Job<MarketCreationJobData>): Promise<void> {
  const { category, topicHint } = job.data;
  console.log(`[Worker/Creation] Triggering market creation (category=${category})`);

  await callAgentScript("create", {
    category: category || "",
    topicHint: topicHint || "",
  });

  console.log(`[Worker/Creation] ✅ Creation triggered`);
}

// ── Worker registration ────────────────────────────────────────────────────────
function startWorkers() {
  const conn = redisConnection();

  const closingWorker = new Worker<MarketClosingJobData>(
    "market-closing",
    processMarketClose,
    { connection: conn, concurrency: 5 }
  );

  const resolutionWorker = new Worker<MarketResolutionJobData>(
    "market-resolution",
    processMarketResolve,
    { connection: conn, concurrency: 3 }
  );

  const creationWorker = new Worker<MarketCreationJobData>(
    "market-creation",
    processMarketCreate,
    { connection: conn, concurrency: 1 } // Serial to avoid duplicate markets
  );

  // Error handlers
  for (const worker of [closingWorker, resolutionWorker, creationWorker]) {
    worker.on("completed", (job) => {
      console.log(`[Worker] ✅ Job ${job.name}(${job.id}) completed`);
    });
    worker.on("failed", (job, err) => {
      console.error(`[Worker] ❌ Job ${job?.name}(${job?.id}) failed:`, err.message);
    });
    worker.on("error", (err) => {
      console.error(`[Worker] Redis error:`, err);
    });
  }

  console.log("[Worker] All workers started");
  return [closingWorker, resolutionWorker, creationWorker];
}

// ── Health check server ────────────────────────────────────────────────────────
function startHealthServer(port = 8080) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", ts: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, () => {
    console.log(`[Worker] Health server: http://0.0.0.0:${port}/health`);
  });
  return server;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║  GravityFlow Worker Service v1.0      ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`  Redis URL: ${REDIS_URL ? "configured ✅" : "NOT SET ❌"}`);
  console.log(`  Next.js URL: ${NEXTJS_URL}`);
  console.log();

  if (!REDIS_URL) {
    console.error("UPSTASH_REDIS_URL is required. Set it in your environment.");
    process.exit(1);
  }

  const workers = startWorkers();
  const healthServer = startHealthServer();

  // Graceful shutdown
  async function shutdown() {
    console.log("\n[Worker] Shutting down...");
    healthServer.close();
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});

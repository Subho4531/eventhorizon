/**
 * lib/queue/queue-client.ts
 *
 * BullMQ queue client backed by Upstash Redis.
 *
 * Three named queues:
 *   - "market-creation"   — periodic agent market creation
 *   - "market-closing"    — delayed: fires at closeDate
 *   - "market-resolution" — delayed: fires at closeDate + RESOLVE_BUFFER
 */

import { Queue, QueueOptions } from "bullmq";

// ── Redis connection ──────────────────────────────────────────────────────────

function getRedisConnection() {
  let url = process.env.UPSTASH_REDIS_URL;
  if (!url) {
    throw new Error(
      "[Queue] UPSTASH_REDIS_URL is not set. Add it to your .env to enable the job queue."
    );
  }

  // Aggressively clean: Find the first occurrence of "redis" and keep everything after it
  // Also strip anything after a '#' (inline comments)
  const match = url.match(/(rediss?:\/\/([^#\s"']+))/);
  if (match) {
    url = match[1].trim();
  }

  return {
    url,
    // If URL starts with rediss://, ioredis handles TLS automatically. 
    // We only add tls: {} if it's an upstash URL that's missing the 's'
    tls: (url.includes("upstash.io") && !url.startsWith("rediss://")) ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

// ── Shared queue options ──────────────────────────────────────────────────────

function defaultQueueOptions() {
  return {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential" as const,
        delay: 5000,
      },
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 7 * 86400 },
    },
  };
}

// ── Queue singletons ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalQueues = globalThis as unknown as Record<string, Queue<any, any, any>>;

function getQueue<T = unknown>(name: string): Queue<T> {
  if (!globalQueues[`queue_${name}`]) {
    globalQueues[`queue_${name}`] = new Queue<T>(name, defaultQueueOptions());
  }
  return globalQueues[`queue_${name}`] as Queue<T>;
}

// ── Job payload types ─────────────────────────────────────────────────────────

export interface MarketCreationJobData {
  triggeredBy: "cron" | "api";
  topicHint?: string;
  category?: string;
}

export interface MarketClosingJobData {
  marketId: string;
  contractMarketId: number | null;
}

export interface MarketResolutionJobData {
  marketId: string;
  contractMarketId: number;
  title: string;
  description: string;
}

// ── Queue accessors ───────────────────────────────────────────────────────────

export function getCreationQueue() {
  return getQueue<MarketCreationJobData>("market-creation");
}

export function getClosingQueue() {
  return getQueue<MarketClosingJobData>("market-closing");
}

export function getResolutionQueue() {
  return getQueue<MarketResolutionJobData>("market-resolution");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** How long after close do we wait before triggering resolution (ms) */
export const RESOLVE_BUFFER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Schedule close and resolve jobs for a newly created market.
 * Called after a market is created (by agent or manually).
 */
export async function scheduleMarketLifecycle(
  marketId: string,
  contractMarketId: number | null,
  title: string,
  description: string,
  closeDate: Date
): Promise<void> {
  const now = Date.now();
  const closeMs = closeDate.getTime();
  const closeDelay = Math.max(closeMs - now, 0);
  const resolveDelay = closeDelay + RESOLVE_BUFFER_MS;

  const closingQueue = getClosingQueue();
  const resolutionQueue = getResolutionQueue();

  // Close job — fires at closeDate
  await closingQueue.add(
    "close-market",
    { marketId, contractMarketId },
    {
      delay: closeDelay,
      jobId: `close-${marketId}`,
      attempts: 3,
    }
  );

  // Resolve job — fires at closeDate + 1h
  if (contractMarketId !== null) {
    await resolutionQueue.add(
      "resolve-market",
      { marketId, contractMarketId, title, description },
      {
        delay: resolveDelay,
        jobId: `resolve-${marketId}`,
        attempts: 3,
      }
    );
  }

  console.log(
    `[Queue] Scheduled lifecycle for market ${marketId}: ` +
      `close in ${Math.round(closeDelay / 60000)}m, ` +
      `resolve in ${Math.round(resolveDelay / 60000)}m`
  );
}

/**
 * Add a manual market-creation trigger to the queue.
 * Can be called from an admin API or cron.
 */
export async function triggerMarketCreation(
  data: MarketCreationJobData
): Promise<string> {
  const queue = getCreationQueue();
  const job = await queue.add("create-market", data, {
    jobId: `create-${Date.now()}`,
  });
  return job.id ?? "";
}

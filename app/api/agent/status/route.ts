/**
 * app/api/agent/status/route.ts
 *
 * GET /api/agent/status
 * GET /api/agent/status?detailed=true
 *
 * Returns agent system health, recent jobs, and queue stats.
 * Auth: Bearer token matching AGENT_API_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkOracleHealth } from "@/lib/web3/server-signer";

function isAuthorized(req: NextRequest): boolean {
  const agentKey = process.env.AGENT_API_KEY;
  if (!agentKey) return true; // If no key configured, allow (for dev)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === agentKey;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const detailed = req.nextUrl.searchParams.get("detailed") === "true";

  try {
    const [oracle, recentJobs, marketStats] = await Promise.all([
      checkOracleHealth().catch(() => ({ healthy: false, error: "Check failed" })),

      prisma.agentJob.findMany({
        orderBy: { createdAt: "desc" },
        take: detailed ? 20 : 5,
      }),

      prisma.market.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const pendingJobs = await prisma.agentJob
      .count({ where: { status: "PENDING" } })
      .catch(() => 0);

    const marketSummary = Object.fromEntries(
      marketStats.map((s) => [s.status, s._count.id])
    );

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      oracle,
      queue: {
        pendingJobs,
        redisConfigured: !!process.env.UPSTASH_REDIS_URL,
      },
      markets: marketSummary,
      agentConfig: {
        serpApiConfigured: !!process.env.SERPAPI_API_KEY,
        pexelsConfigured: !!process.env.PEXELS_API_KEY,
        openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
        contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "not set",
      },
      recentJobs: recentJobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        marketId: j.marketId,
        error: j.error,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

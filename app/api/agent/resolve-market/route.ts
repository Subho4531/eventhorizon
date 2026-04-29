/**
 * app/api/agent/resolve-market/route.ts
 *
 * POST /api/agent/resolve-market
 *
 * Called by the Python agent or BullMQ worker to resolve a market:
 *   1. Verify market is closed / past close date
 *   2. Submit on-chain resolve() signed by oracle keypair
 *   3. Update DB: status=RESOLVED, outcome, resolvedAt, resolutionTxHash
 *
 * Auth: Bearer token matching AGENT_API_KEY env var
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverResolveMarket } from "@/lib/web3/server-signer";

function isAuthorized(req: NextRequest): boolean {
  const agentKey = process.env.AGENT_API_KEY;
  if (!agentKey) return false;
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === agentKey;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      marketId,
      outcome,     // "YES" | "NO"
      payoutBps,   // optional, default 20000 (2x for winners)
      evidence,    // optional string — reasoning from agent
    } = body;

    // ── Validation ─────────────────────────────────────────────────────────
    if (!marketId || !outcome) {
      return NextResponse.json(
        { error: "Missing required fields: marketId, outcome" },
        { status: 400 }
      );
    }

    if (outcome !== "YES" && outcome !== "NO") {
      return NextResponse.json(
        { error: "outcome must be 'YES' or 'NO'" },
        { status: 400 }
      );
    }

    // ── Fetch market ────────────────────────────────────────────────────────
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status === "RESOLVED") {
      return NextResponse.json(
        { error: "Market is already resolved" },
        { status: 409 }
      );
    }

    // Allow resolving OPEN markets that are past close date, or CLOSED markets
    const now = new Date();
    if (market.status === "OPEN" && market.closeDate > now) {
      return NextResponse.json(
        {
          error: "Market betting period has not ended yet",
          closeDate: market.closeDate,
        },
        { status: 422 }
      );
    }

    // ── On-chain resolution ─────────────────────────────────────────────────
    let chainResult: { success: boolean; hash: string; error?: string } = {
      success: false,
      hash: "",
      error: "No contractMarketId",
    };

    if (market.contractMarketId !== null) {
      chainResult = await serverResolveMarket(
        market.contractMarketId,
        outcome as "YES" | "NO",
        payoutBps ?? 20000
      );
    } else {
      // Markets without a contractMarketId are off-chain only (e.g., seeded demos)
      chainResult = { success: true, hash: "off-chain", error: undefined };
    }

    // ── Update DB ───────────────────────────────────────────────────────────
    const updatedMarket = await prisma.market.update({
      where: { id: marketId },
      data: {
        status: "RESOLVED",
        outcome,
        payoutBps: payoutBps ?? 20000,
        resolvedAt: now,
        resolutionTxHash: chainResult.hash || null,
      },
    });

    // ── Log agent job ───────────────────────────────────────────────────────
    await prisma.agentJob.create({
      data: {
        type: "RESOLVE_MARKET",
        marketId,
        status: chainResult.success ? "COMPLETED" : "PARTIAL",
        payload: { marketId, outcome, payoutBps: payoutBps ?? 20000, evidence },
        result: { txHash: chainResult.hash },
        error: chainResult.error ?? null,
        attempts: 1,
        scheduledAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(console.warn);

    return NextResponse.json({
      success: true,
      market: {
        id: updatedMarket.id,
        status: updatedMarket.status,
        outcome: updatedMarket.outcome,
        resolvedAt: updatedMarket.resolvedAt,
      },
      chain: {
        success: chainResult.success,
        hash: chainResult.hash,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[/api/agent/resolve-market]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

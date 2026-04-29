/**
 * app/api/agent/create-market/route.ts
 *
 * POST /api/agent/create-market
 *
 * Called by the Python agent to:
 *   1. Create market on-chain (oracle signs autonomously)
 *   2. Index the market in Supabase/Postgres
 *   3. Schedule BullMQ close + resolve jobs
 *
 * Auth: Bearer token matching AGENT_API_KEY env var
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverCreateMarket } from "@/lib/web3/server-signer";
import { scheduleMarketLifecycle } from "@/lib/queue/queue-client";

// ── Auth middleware ───────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const agentKey = process.env.AGENT_API_KEY;
  if (!agentKey) return false; // No key set → deny

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  return authHeader.slice(7) === agentKey;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      category,
      closeDate: closeDateStr,
      imageUrl,
      imageSource,
      imageSearchQuery,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!title || !closeDateStr) {
      return NextResponse.json(
        { error: "Missing required fields: title, closeDate" },
        { status: 400 }
      );
    }

    const closeDate = new Date(closeDateStr);
    if (isNaN(closeDate.getTime()) || closeDate <= new Date()) {
      return NextResponse.json(
        { error: "closeDate must be a valid future datetime" },
        { status: 400 }
      );
    }

    // ── On-chain creation ─────────────────────────────────────────────────────
    const closeTimeUnix = Math.floor(closeDate.getTime() / 1000);
    console.log(`[API Agent] Submitting to Soroban: "${title}" (Closes: ${closeDateStr})`);
    
    const chainResult = await serverCreateMarket(title, closeTimeUnix);
    
    if (!chainResult.success) {
      console.error("[/api/agent/create-market] On-chain creation failed:", chainResult.error);
      // Continue — store in DB without contractMarketId in degraded mode
    } else {
      console.log(`[API Agent] On-chain success! Hash: ${chainResult.hash}, ID: ${chainResult.contractMarketId}`);
    }

    console.log("[API Agent] Indexing in Database...");

    // Oracle public key = signer
    const { getOracleKeypair } = await import("@/lib/web3/server-signer");
    const keypair = await getOracleKeypair();
    const oraclePublicKey = keypair.publicKey();

    // ── DB indexing ───────────────────────────────────────────────────────────
    const scheduledResolveAt = new Date(
      closeDate.getTime() + 60 * 60 * 1000 // +1h after close
    );

    let market;
    try {
      market = await prisma.market.create({
        data: {
          title,
          description: description ?? "",
          category: category ?? "General",
          imageUrl: imageUrl ?? "",
          imageSource: imageSource ?? null,
          imageSearchQuery: imageSearchQuery ?? null,
          closeDate,
          scheduledResolveAt,
          agentCreated: true,
          creationTxHash: chainResult.hash || null,
          contractMarketId: chainResult.contractMarketId ?? null,
          oracleAddress: oraclePublicKey,
          status: "OPEN",
          creator: {
            connectOrCreate: {
              where: { publicKey: oraclePublicKey },
              create: {
                publicKey: oraclePublicKey,
                name: "GravityFlow Oracle",
                balance: 0,
              },
            },
          },
        },
      });
    } catch (prismaErr) {
      const prismaMsg = prismaErr instanceof Error ? prismaErr.message : String(prismaErr);
      console.error("[/api/agent/create-market] DB insert failed:", prismaMsg);
      return NextResponse.json(
        { error: `DB insert failed: ${prismaMsg}` },
        { status: 500 }
      );
    }

    // ── Schedule lifecycle jobs ───────────────────────────────────────────────
    try {
      await scheduleMarketLifecycle(
        market.id,
        market.contractMarketId,
        market.title,
        market.description ?? "",
        closeDate
      );
    } catch (queueErr) {
      // Non-fatal — queue might not be configured in dev
      console.warn("[/api/agent/create-market] Queue scheduling failed:", queueErr);
    }

    // ── Log agent job ─────────────────────────────────────────────────────────
    await prisma.agentJob.create({
      data: {
        type: "CREATE_MARKET",
        marketId: market.id,
        status: chainResult.success ? "COMPLETED" : "PARTIAL",
        payload: { title, closeDate: closeDateStr, category },
        result: {
          contractMarketId: chainResult.contractMarketId,
          txHash: chainResult.hash,
        },
        error: chainResult.error ?? null,
        attempts: 1,
        scheduledAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(console.warn); // Non-fatal

    return NextResponse.json(
      {
        success: true,
        market: {
          id: market.id,
          title: market.title,
          contractMarketId: market.contractMarketId,
          closeDate: market.closeDate,
          status: market.status,
        },
        chain: {
          success: chainResult.success,
          hash: chainResult.hash,
          contractMarketId: chainResult.contractMarketId,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[/api/agent/create-market]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

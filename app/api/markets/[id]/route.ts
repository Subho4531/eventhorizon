/**
 * app/api/markets/[id]/route.ts
 *
 * GET  /api/markets/[id]      — fetch single market
 * PATCH /api/markets/[id]     — update market status (for worker)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/markets/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;

    if (!marketId) {
      return NextResponse.json({ error: "Missing market id" }, { status: 400 });
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    return NextResponse.json(market);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// PATCH /api/markets/[id] — internal use by worker to close markets
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: worker must supply AGENT_API_KEY
    const agentKey = process.env.AGENT_API_KEY;
    if (agentKey) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== agentKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { id: marketId } = await params;
    const body = await req.json();
    const { status } = body;

    const allowedStatuses = ["OPEN", "CLOSED", "RESOLVED", "DISPUTED"];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const market = await prisma.market.update({
      where: { id: marketId },
      data: { status },
    });

    return NextResponse.json({ success: true, market });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[PATCH /api/markets/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

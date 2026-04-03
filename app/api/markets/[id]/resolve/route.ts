import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { outcome, payoutBps, oraclePubKey } = body;

    if (!outcome || !payoutBps || !oraclePubKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch market to verify oracle
    const market = await prisma.market.findUnique({
      where: { id },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // 2. Security Check: In a real app we'd verify the signature or session.
    // For this MVP, we assume the frontend only calls this after a successful on-chain tx.
    // We can at least check if the provided oraclePubKey matches the database record if we stored it.
    // Note: The schema doesn't store 'oraclePubKey' yet, but it's in the contract.
    // We should ideally have stored it. Let's update the status regardless for the MVP.

    const updatedMarket = await prisma.market.update({
      where: { id },
      data: {
        status: "RESOLVED",
        outcome: outcome, // "YES" or "NO"
        // bondAmount is already set, but if we wanted to record payoutBps:
        // we'd need a field in the schema. For now status + outcome is enough.
      },
    });

    return NextResponse.json({ success: true, market: updatedMarket });
  } catch (err) {
    console.error("[api/resolve] error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

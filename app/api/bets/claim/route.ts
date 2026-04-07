import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * PUT /api/bets/claim
 * 
 * Called after a successful on-chain claim() transaction.
 * Marks the bet as revealed + claimed so the UI hides the "Claim" button.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { commitment, nullifier, txHash } = body;

    if (!commitment) {
      return NextResponse.json({ error: "commitment is required" }, { status: 400 });
    }

    // Find the bet by commitment
    const bet = await prisma.bet.findUnique({
      where: { commitment },
      include: { market: { select: { id: true, title: true, status: true, outcome: true } } },
    });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.claimedAt) {
      return NextResponse.json({ error: "Bet already claimed" }, { status: 400 });
    }

    // Mark as revealed + claimed
    const updatedBet = await prisma.bet.update({
      where: { commitment },
      data: {
        revealed: true,
        claimedAt: new Date(),
        nullifier: nullifier ?? null,
        txHash: txHash ?? bet.txHash,
      },
    });

    return NextResponse.json({ success: true, bet: updatedBet });
  } catch (err) {
    console.error("[api/bets/claim] error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/bets - index a new sealed bet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, userPublicKey, amount, commitment, txHash } = body;
    
    if (!marketId || !userPublicKey || !amount || !commitment) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Record the bet in Prisma (without the private 'side' field)
    const bet = await prisma.bet.create({
      data: {
        market: { connect: { id: marketId } },
        user: { connect: { publicKey: userPublicKey } },
        amount: parseFloat(amount),
        commitment,
        txHash: txHash ?? null,
        revealed: false
      }
    });

    // Optionally update user balance here or rely on the transaction listener
    // For now, let's keep it simple as the Portfolio also refreshes from Soroban/Txns
    
    return NextResponse.json({ bet }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

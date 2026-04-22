import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// GET /api/transactions?publicKey=...
export async function GET(req: NextRequest) {
  const publicKey = req.nextUrl.searchParams.get("publicKey");
  const limit = req.nextUrl.searchParams.get("limit");
  
  try {
    const transactions = await prisma.transaction.findMany({
      where: publicKey ? { userPublicKey: publicKey } : {},
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit, 10) : undefined,
    });
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// POST /api/transactions  — record a transaction + update balance
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicKey, type, amount, hash } = body;

    if (!publicKey || !type || amount === undefined) {
      return NextResponse.json({ error: "publicKey, type, amount required" }, { status: 400 });
    }

    const isPositive = type === "DEPOSIT" || type === "CLAIM";
    const balanceDelta = isPositive ? amount : -amount;

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userPublicKey: publicKey,
          type,
          amount,
          hash: hash ?? "",
        },
      }),
      prisma.user.update({
        where: { publicKey },
        data: { balance: { increment: balanceDelta } },
      }),
    ]);

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

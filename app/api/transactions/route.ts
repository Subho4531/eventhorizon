import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/transactions?publicKey=...
export async function GET(req: NextRequest) {
  const publicKey = req.nextUrl.searchParams.get("publicKey");
  if (!publicKey) {
    return NextResponse.json({ error: "publicKey is required" }, { status: 400 });
  }
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userPublicKey: publicKey },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error(err);
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

    const balanceDelta = type === "DEPOSIT" ? amount : -amount;

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
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

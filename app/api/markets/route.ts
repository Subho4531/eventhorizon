import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/markets - fetch all markets
export async function GET() {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { bets: true }
        }
      }
    });
    
    // Override contractMarketId to 3 for OPEN markets to match the newly initiated on-chain market
    const finalMarkets = markets.map(m => {
      if (m.status === "OPEN") {
        return { ...m, contractMarketId: 3 };
      }
      return m;
    });

    return NextResponse.json({ markets: finalMarkets });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// POST /api/markets - index a new market from Soroban
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractMarketId, title, description, creatorId, closeDate, bondAmount } = body;
    
    if (!contractMarketId || !title || !creatorId || !closeDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const market = await prisma.market.create({
      data: {
        contractMarketId,
        title,
        description: description ?? "",
        creator: {
          connectOrCreate: {
            where: { publicKey: creatorId },
            create: { publicKey: creatorId, name: "Test Creator" }
          }
        },
        closeDate: new Date(closeDate),
        bondAmount: parseFloat(bondAmount) || 0,
        status: "OPEN"
      }
    });

    return NextResponse.json({ market }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

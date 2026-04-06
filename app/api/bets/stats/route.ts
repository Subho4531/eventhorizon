import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/bets/stats - get aggregate bet statistics
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const marketId = searchParams.get("marketId");

    // Build where clause
    const where: Prisma.BetWhereInput = {};
    if (marketId) {
      where.marketId = marketId;
    }

    // Get aggregate statistics
    const [aggregates, sealedCount, revealedCount] = await Promise.all([
      prisma.bet.aggregate({
        where,
        _sum: {
          amount: true
        },
        _count: {
          id: true
        },
        _avg: {
          amount: true
        }
      }),
      prisma.bet.count({
        where: {
          ...where,
          revealed: false
        }
      }),
      prisma.bet.count({
        where: {
          ...where,
          revealed: true
        }
      })
    ]);

    return NextResponse.json({
      totalVolume: aggregates._sum.amount || 0,
      betCount: aggregates._count.id || 0,
      avgBetSize: aggregates._avg.amount || 0,
      sealedCount,
      revealedCount
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch bet statistics" }, { status: 500 });
  }
}

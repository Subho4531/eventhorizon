import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

// POST /api/bets - index a new sealed bet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, userPublicKey, amount, side, commitment, txHash } = body;
    
    if (!marketId || !userPublicKey || !amount || !commitment) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate side
    if (!side || (side !== "YES" && side !== "NO")) {
      return NextResponse.json({ error: "side must be YES or NO" }, { status: 400 });
    }

    const stake = parseFloat(amount);
    if (isNaN(stake) || stake < 1) {
      return NextResponse.json({ error: "Minimum bet is 1 XLM" }, { status: 400 });
    }

    // Verify market exists and is OPEN
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true, status: true }
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "OPEN") {
      return NextResponse.json({ error: "Market is closed" }, { status: 400 });
    }

    // Enforce one bet per user per market
    const existingBet = await prisma.bet.findFirst({
      where: { marketId, userPublicKey },
      select: { id: true },
    });
    if (existingBet) {
      return NextResponse.json(
        { error: "You have already placed a bet on this market. Only one position per market is allowed." },
        { status: 409 }
      );
    }

    // Ensure user exists (we skip strict DB balance check here because the contract handles it on-chain)
    const defaultPfp = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(userPublicKey)}`;
    await prisma.user.upsert({
      where: { publicKey: userPublicKey },
      update: {},
      create: { 
        publicKey: userPublicKey, 
        name: "", 
        balance: 1000,
        pfpUrl: defaultPfp 
      },
      select: { publicKey: true, balance: true },
    });

    // Atomic transaction: create bet + update pool + record transaction
    const [bet] = await prisma.$transaction([
      prisma.bet.create({
        data: {
          market: { connect: { id: marketId } },
          user: { connect: { publicKey: userPublicKey } },
          amount: stake,
          commitment,
          txHash: txHash ?? null,
          revealed: false,
        },
      }),
      prisma.market.update({
        where: { id: marketId },
        data: {
          ...(side === "YES"
            ? { yesPool: { increment: stake } }
            : { noPool: { increment: stake } }),
          totalVolume: { increment: stake },
        },
      }),
      prisma.transaction.create({
        data: {
          userPublicKey,
          type: "BET",
          amount: stake,
          hash: txHash ?? "",
        },
      }),
      prisma.user.update({
        where: { publicKey: userPublicKey },
        data: { 
          balance: { decrement: stake },
          totalSpent: { increment: stake }
        },
      }),
    ]);

    // Invalidate probability + quality cache so scores recalculate with new data
    try {
      const { invalidateCache } = await import("@/lib/intelligence/probability-model");
      invalidateCache(marketId);
      // Also clear quality score cache (bet count affects activity score)
      const { intelligenceCache } = await import("@/lib/cache/intelligence-cache");
      intelligenceCache.delete(`quality:${marketId}`);
    } catch {
      // Cache invalidation is non-critical
    }
    
    return NextResponse.json({ bet }, { status: 201 });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// GET /api/bets - fetch bets with filtering, sorting, and pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Extract query parameters
    const marketId = searchParams.get("marketId");
    const userPublicKey = searchParams.get("userPublicKey");
    const status = searchParams.get("status"); // "sealed" or "revealed"
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sortBy") || "createdAt"; // "amount" or "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"; // "asc" or "desc"

    // Build where clause
    const where: Prisma.BetWhereInput = {};
    
    if (marketId) {
      where.marketId = marketId;
    }
    
    if (userPublicKey) {
      where.userPublicKey = userPublicKey;
    }
    
    if (status === "sealed") {
      where.revealed = false;
    } else if (status === "revealed") {
      where.revealed = true;
    }

    // Build orderBy clause
    const orderBy: Prisma.BetOrderByWithRelationInput = {};
    if (sortBy === "amount") {
      orderBy.amount = sortOrder as "asc" | "desc";
    } else {
      orderBy.createdAt = sortOrder as "asc" | "desc";
    }

    // Fetch bets with relations
    const bets = await prisma.bet.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            imageUrl: true,
            contractMarketId: true
          }
        },
        user: {
          select: {
            publicKey: true,
            name: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.bet.count({ where });

    return NextResponse.json({
      bets,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "Failed to fetch bets" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

// POST /api/bets - index a new sealed bet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, userPublicKey, amount, commitment, txHash } = body;
    
    if (!marketId || !userPublicKey || !amount || !commitment) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    // Record the bet in Prisma (without the private 'side' field)
    const bet = await prisma.bet.create({
      data: {
        market: { connect: { id: marketId } },
        user: { 
          connectOrCreate: {
            where: { publicKey: userPublicKey },
            create: { publicKey: userPublicKey, name: "Test User" }
          }
        },
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
            status: true
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
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch bets" }, { status: 500 });
  }
}

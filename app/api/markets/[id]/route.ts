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
      where: { id: marketId }
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

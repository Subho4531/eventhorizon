import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const markets = await prisma.market.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });

    if (markets.length > 0) {
      await prisma.market.update({
        where: { id: markets[0].id },
        data: { contractMarketId: 3 } // The custom ORACLE market ID we created for GCVSH...
      });
      return NextResponse.json({ success: true, message: `Updated market ${markets[0].title} to contractMarketId 3` });
    }

    return NextResponse.json({ success: false, message: "No OPEN markets found to update" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Group bets by day for the last 7 days
    const dailyVolume = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        SUM(amount) as volume
      FROM "Bet"
      WHERE "createdAt" >= ${sevenDaysAgo}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return NextResponse.json({ dailyVolume });
  } catch (error) {
    console.error("Error fetching volume stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

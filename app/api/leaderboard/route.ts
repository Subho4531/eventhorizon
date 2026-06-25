import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    // Rank users by net profit: totalWinnings - totalSpent on resolved markets
    const users = await prisma.$queryRaw`
      SELECT 
        u.public_key as "publicKey", 
        u.name, 
        u.pfp_url as "pfpUrl", 
        u.balance, 
        u.total_winnings as "totalWinnings",
        u.total_spent as "totalSpent",
        COALESCE(u.total_winnings - (
          SELECT COALESCE(SUM(b.amount), 0)
          FROM bets b
          JOIN markets m ON b.market_id = m.id
          WHERE b.user_public_key = u.public_key AND m.status = 'RESOLVED'
        ), 0) as "netProfit"
      FROM users u
      ORDER BY COALESCE(u.total_winnings - (
        SELECT COALESCE(SUM(b.amount), 0)
        FROM bets b
        JOIN markets m ON b.market_id = m.id
        WHERE b.user_public_key = u.public_key AND m.status = 'RESOLVED'
      ), 0) DESC
      LIMIT 50
    `;

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Leaderboard API error:", err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}


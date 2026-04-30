import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    // Rank users by net profit: totalWinnings - totalSpent
    const users = await prisma.$queryRaw`
      SELECT 
        public_key as "publicKey", 
        name, 
        pfp_url as "pfpUrl", 
        balance, 
        total_winnings as "totalWinnings",
        total_spent as "totalSpent",
        (total_winnings - total_spent) as "netProfit"
      FROM users
      ORDER BY (total_winnings - total_spent) DESC
      LIMIT 50
    `;

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Leaderboard API error:", err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

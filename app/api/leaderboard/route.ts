import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { totalWinnings: "desc" },
      take: 50,
      select: {
        publicKey: true,
        name: true,
        pfpUrl: true,
        balance: true,
        totalWinnings: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Leaderboard API error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/users?publicKey=...
export async function GET(req: NextRequest) {
  const publicKey = req.nextUrl.searchParams.get("publicKey");
  if (!publicKey) {
    return NextResponse.json({ error: "publicKey is required" }, { status: 400 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { publicKey },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// POST /api/users  — create user (onboarding)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicKey, name, pfpUrl } = body;
    if (!publicKey || !name) {
      return NextResponse.json({ error: "publicKey and name are required" }, { status: 400 });
    }
    const defaultPfp = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(publicKey)}`;
    const user = await prisma.user.upsert({
      where: { publicKey },
      create: { 
        publicKey, 
        name, 
        pfpUrl: pfpUrl || defaultPfp 
      },
      update: {},
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

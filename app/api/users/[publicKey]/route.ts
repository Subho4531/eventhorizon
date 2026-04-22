import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// PUT /api/users/[publicKey]  — update profile
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  try {
    const { publicKey } = await params;
    const body = await req.json();
    const { name, bio, pfpUrl, links } = body;

    const user = await prisma.user.update({
      where: { publicKey },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(pfpUrl !== undefined && { pfpUrl }),
        ...(links !== undefined && { links }),
      },
    });
    return NextResponse.json({ user });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Internal Error");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

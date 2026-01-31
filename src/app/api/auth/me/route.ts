import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthCookie } from "@/lib/auth/cookies";
import { verifyAuthJwt } from "@/lib/auth/jwt";

export async function GET() {
  const token = await getAuthCookie();
  if (!token) return NextResponse.json({ ok: true, user: null });

  try {
    const payload = await verifyAuthJwt(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json({ ok: true, user: null });
  }
}

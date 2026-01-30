import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  clearSessionCookie,
  getSessionIdFromCookie,
} from "@/lib/auth/authCookies";

export const runtime = "nodejs";

export async function POST() {
  const sessionId = await getSessionIdFromCookie();
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  await clearSessionCookie();
  return NextResponse.redirect(
    new URL(
      "/login",
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    ),
  );
}

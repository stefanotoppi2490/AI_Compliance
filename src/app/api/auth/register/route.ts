import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/db/prisma";
import { setSessionCookie } from "@/lib/auth/authCookies";

type Body = { email: string; password: string; name?: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json(
      { ok: false, message: "Bad request" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const name = body.name?.trim() || null;

  if (!isValidEmail(email) || password.length < 8) {
    return NextResponse.json(
      {
        ok: false,
        message: "Email non valida o password troppo corta (min 8).",
      },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { ok: false, message: "Email già registrata." },
      { status: 409 },
    );
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true },
  });

  // session 30 giorni
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt },
    select: { id: true, expiresAt: true },
  });

  await setSessionCookie(session.id, session.expiresAt);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
}

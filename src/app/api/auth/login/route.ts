import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { setSessionCookie } from "@/lib/auth/authCookies";
import { makeSessionExpiry } from "@/lib/auth/session";
import argon2 from "argon2";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const password = (body?.password ?? "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, message: "Dati mancanti." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Credenziali non valide." },
        { status: 401 },
      );
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, message: "Credenziali non valide." },
        { status: 401 },
      );
    }

    const expiresAt = makeSessionExpiry();
    const session = await prisma.session.create({
      data: { userId: user.id, expiresAt },
      select: { id: true },
    });

    await setSessionCookie(session.id, expiresAt);

    return NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name } },
      { status: 200 },
    );
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json(
      { ok: false, message: "Errore interno." },
      { status: 500 },
    );
  }
}

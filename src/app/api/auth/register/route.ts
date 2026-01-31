import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signAuthJwt } from "@/lib/auth/jwt";
import { setAuthCookieOnResponse } from "@/lib/auth/cookies";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "Email already in use" },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(parsed.data.password),
    },
  });

  const token = await signAuthJwt({ sub: user.id, email: user.email });

  const res = NextResponse.json({ ok: true, user });
  setAuthCookieOnResponse(res, token); // ✅ qui
  return res;
}

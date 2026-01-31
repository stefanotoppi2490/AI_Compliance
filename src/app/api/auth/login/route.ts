import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAuthJwt } from "@/lib/auth/jwt";
import { setAuthCookieOnResponse } from "@/lib/auth/cookies";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(parsed.data.password, user.password);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }

  const token = await signAuthJwt({ sub: user.id, email: user.email });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  });
  setAuthCookieOnResponse(res, token); // ✅ qui
  return res;
}

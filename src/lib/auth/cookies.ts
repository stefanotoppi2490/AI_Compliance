import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export function authCookieName() {
  return process.env.AUTH_COOKIE_NAME || "ai_compliance_token";
}

export function setAuthCookieOnResponse(res: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set(authCookieName(), token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookieOnResponse(res: NextResponse) {
  res.cookies.set(authCookieName(), "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

// ✅ AGGIUNGI QUESTO
export async function getAuthCookie(): Promise<string | null> {
  return (await cookies()).get(authCookieName())?.value ?? null;
}

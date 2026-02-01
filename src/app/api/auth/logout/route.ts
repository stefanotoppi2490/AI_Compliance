import { NextResponse } from "next/server";
import { clearAuthCookieOnResponse } from "@/lib/auth/cookies";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const loginUrl = new URL("/login", url.origin);
  const res = NextResponse.redirect(loginUrl);
  clearAuthCookieOnResponse(res);
  return res;
}

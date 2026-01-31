import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuthJwt } from "@/lib/auth/jwt";
import { authCookieName } from "@/lib/auth/cookies";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // static / next internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon"))
    return NextResponse.next();

  // allow public
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  // protect app pages + api (eccetto auth)
  const token = req.cookies.get(authCookieName())?.value;
  if (!token) {
    // api -> 401, pages -> redirect
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  try {
    await verifyAuthJwt(token);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

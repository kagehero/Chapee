import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const COOKIE_NAME = "auth-token";

const protectedPaths = [
  "/",
  "/dashboard",
  "/chats",
  "/templates",
  "/auto-reply",
  "/staff",
];

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/" || protectedPaths.some((p) => pathname === p)) return true;
  if (pathname.startsWith("/chats/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET || "please-change-this-secret-key"
  );

  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage && token) {
    try {
      await jose.jwtVerify(token, secret);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch {
      // トークン無効の場合はそのままログイン画面へ
    }
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jose.jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/dashboard",
    "/chats/:path*",
    "/templates",
    "/auto-reply",
    "/staff",
  ],
};

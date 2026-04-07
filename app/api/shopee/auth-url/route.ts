import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { generateShopAuthUrl } from "@/lib/shopee-api";

const OAUTH_COOKIE = "shopee_oauth_state";
const COOKIE_MAX_AGE = 600;

/**
 * GET /api/shopee/auth-url
 * Returns Shopee OAuth URL (Partner ID/Key stay server-side).
 * Sets HttpOnly cookie so /api/shopee/callback can verify the flow started here.
 */
export async function GET(request: NextRequest) {
  const partnerId = process.env.SHOPEE_PARTNER_ID?.trim();
  const partnerKey = process.env.SHOPEE_PARTNER_KEY?.trim();
  if (!partnerId || !partnerKey) {
    return NextResponse.json(
      { error: "Shopee Partner 設定が不足しています（サーバー環境を確認してください）" },
      { status: 503 }
    );
  }

  const redirectUrl =
    process.env.SHOPEE_REDIRECT_URL?.trim() ||
    new URL("/api/shopee/callback", request.url).toString();

  const countryParam = new URL(request.url).searchParams.get("country");
  const country =
    countryParam && countryParam.trim() !== ""
      ? countryParam.trim().toUpperCase()
      : undefined;

  let url: string;
  try {
    url = generateShopAuthUrl(redirectUrl, country ? { country } : undefined);
  } catch (e) {
    console.error("generateShopAuthUrl:", e);
    return NextResponse.json(
      { error: "認証URLの生成に失敗しました" },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.json({ url });
  res.cookies.set(OAUTH_COOKIE, state, {
    httpOnly: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

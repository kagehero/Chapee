import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection } from "@/lib/mongodb";
import { getShopeeBaseUrl } from "@/lib/shopee-api";

const PARTNER_ID = parseInt(process.env.SHOPEE_PARTNER_ID || "0");
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";

/**
 * GET /api/shopee/debug
 * Dumps token info and validates it via get_shop_info
 */
export async function GET() {
  try {
    // 1. Load token from DB
    const col = await getCollection<{
      shop_id: number;
      shop_name?: string;
      country: string;
      access_token: string;
      refresh_token: string;
      expires_at: Date;
      updated_at: Date;
    }>("shopee_tokens");

    const tokens = await col.find({}).toArray();

    if (tokens.length === 0) {
      return NextResponse.json({ error: "No tokens found in DB" }, { status: 404 });
    }

    const results = await Promise.all(
      tokens.map(async (token) => {
        const now = new Date();
        const expiresIn = Math.floor(
          (token.expires_at.getTime() - now.getTime()) / 1000 / 60
        );

        const at = token.access_token;
        // Print full token to server console for inspection
        console.log(`[Debug] shop_id: ${token.shop_id}`);
        console.log(`[Debug] access_token: ${at}`);
        console.log(`[Debug] expires_at: ${token.expires_at}`);
        const maskedToken =
          at.length > 12 ? `${at.slice(0, 8)}...${at.slice(-4)}` : at;

        // 2. Validate via get_shop_info
        const path = "/api/v2/shop/get_shop_info";
        const timestamp = Math.floor(Date.now() / 1000);
        const baseString = `${PARTNER_ID}${path}${timestamp}${token.access_token}${token.shop_id}`;
        const sign = crypto
          .createHmac("sha256", PARTNER_KEY)
          .update(baseString)
          .digest("hex");

        const base = getShopeeBaseUrl(token.country);
        const url =
          `${base}${path}?` +
          `partner_id=${PARTNER_ID}&` +
          `timestamp=${timestamp}&` +
          `access_token=${token.access_token}&` +
          `shop_id=${token.shop_id}&` +
          `sign=${sign}`;

        let shopInfo: Record<string, unknown> = {};
        let shopInfoError: string | null = null;
        let httpStatus = 0;

        try {
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          httpStatus = res.status;
          shopInfo = await res.json();
          if (shopInfo.error) {
            shopInfoError = `${shopInfo.error}: ${shopInfo.message}`;
          }
        } catch (e) {
          shopInfoError = e instanceof Error ? e.message : "fetch failed";
        }

        return {
          shop_id: token.shop_id,
          country: token.country,
          access_token_preview: maskedToken,
          access_token_length: at.length,
          expires_at: token.expires_at,
          expires_in_minutes: expiresIn,
          is_expired: expiresIn <= 0,
          updated_at: token.updated_at,
          env_partner_id: PARTNER_ID,
          env_partner_key_length: PARTNER_KEY.length,
          get_shop_info_status: httpStatus,
          get_shop_info_error: shopInfoError,
          get_shop_info_response: shopInfo,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Debug failed" },
      { status: 500 }
    );
  }
}

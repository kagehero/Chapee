import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAccessToken, getShopInfo } from "@/lib/shopee-api";
import { getCollection } from "@/lib/mongodb";

const OAUTH_COOKIE = "shopee_oauth_state";

/**
 * Shopee OAuth callback - exchanges code for access token
 * Called when user authorizes the app via Shopee
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oauthError = searchParams.get("error");
    const cookieStore = await cookies();

    if (oauthError) {
      cookieStore.delete(OAUTH_COOKIE);
      return NextResponse.redirect(
        new URL(
          `/dashboard?shopee_error=${encodeURIComponent(
            "Shopee側で認証が拒否されたか、キャンセルされました。"
          )}`,
          request.url
        )
      );
    }

    if (!cookieStore.get(OAUTH_COOKIE)?.value) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?shopee_error=${encodeURIComponent(
            "連携セッションが無効です。「Shopeeアカウントを連携」を再度お試しください。"
          )}`,
          request.url
        )
      );
    }
    cookieStore.delete(OAUTH_COOKIE);

    const code = searchParams.get("code");
    const shopIdParam = searchParams.get("shop_id");
    const country = searchParams.get("country") || "SG";

    if (!code) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?shopee_error=${encodeURIComponent(
            "認証コードを取得できませんでした。もう一度お試しください。"
          )}`,
          request.url
        )
      );
    }

    if (!shopIdParam) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?shopee_error=${encodeURIComponent(
            "ショップ情報を取得できませんでした。"
          )}`,
          request.url
        )
      );
    }

    const shopId = parseInt(shopIdParam);

    // Exchange code for access token
    const tokenData = await getAccessToken(code, shopId, { country });

    // Get shop info to store shop name
    let shopName = `${country || "SG"} Shop ${shopId}`;
    try {
      const shopInfo = await getShopInfo(tokenData.access_token, shopId, {
        country,
      });
      shopName = shopInfo.shop_name || shopName;
    } catch (err) {
      console.log("Failed to get shop info, using default name");
    }

    // Store token in database
    const col = await getCollection<{
      shop_id: number;
      shop_name?: string;
      country: string;
      access_token: string;
      refresh_token: string;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>("shopee_tokens");

    const expiresAt = new Date(Date.now() + tokenData.expire_in * 1000);

    await col.updateOne(
      { shop_id: shopId },
      {
        $set: {
          shop_name: shopName,
          country: country,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date(),
        },
        $setOnInsert: {
          shop_id: shopId,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.redirect(
      new URL("/dashboard?shopee_connected=true", request.url)
    );
  } catch (error) {
    console.error("Shopee callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/dashboard?shopee_error=${encodeURIComponent(
          error instanceof Error ? error.message : "接続に失敗しました"
        )}`,
        request.url
      )
    );
  }
}

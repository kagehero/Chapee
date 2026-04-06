import { NextRequest, NextResponse } from "next/server";
import { getShopNotification } from "@/lib/shopee-api";
import { getValidToken, getConnectedShops } from "@/lib/shopee-token";

/**
 * GET /api/shopee/shop-notifications
 * Shopee Seller Center 通知 API（get_shop_notification）のプロキシ。
 *
 * Query:
 * - shop_id（任意）未指定時は接続済み先頭店舗
 * - cursor（任意）前回レスポンスの cursor
 * - page_size（任意）1〜50
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get("shop_id");
    const cursor = searchParams.get("cursor") ?? undefined;
    const pageSizeRaw = searchParams.get("page_size");
    const page_size = pageSizeRaw ? parseInt(pageSizeRaw, 10) : undefined;

    const shops = await getConnectedShops();
    let shopId: number;
    let country: string | undefined;

    if (shopIdParam) {
      shopId = parseInt(shopIdParam, 10);
      if (!Number.isFinite(shopId)) {
        return NextResponse.json({ error: "shop_id が不正です" }, { status: 400 });
      }
      const row = shops.find((s) => s.shop_id === shopId);
      country = row?.country
        ? String(row.country).trim() || undefined
        : undefined;
    } else {
      if (shops.length === 0) {
        return NextResponse.json(
          { error: "接続済みショップがありません" },
          { status: 400 }
        );
      }
      shopId = shops[0].shop_id;
      country = shops[0].country
        ? String(shops[0].country).trim() || undefined
        : undefined;
    }

    const accessToken = await getValidToken(shopId);
    const data = await getShopNotification(
      accessToken,
      shopId,
      {
        ...(cursor ? { cursor } : {}),
        ...(page_size != null && Number.isFinite(page_size)
          ? { page_size }
          : {}),
      },
      country ? { country } : undefined
    );

    return NextResponse.json({ shop_id: shopId, ...data });
  } catch (error) {
    console.error("[shop-notifications]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "通知の取得に失敗しました",
      },
      { status: 500 }
    );
  }
}

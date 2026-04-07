import { NextRequest, NextResponse } from "next/server";
import { getShopNotification } from "@/lib/shopee-api";
import { getValidToken, getConnectedShops } from "@/lib/shopee-token";
import {
  dedupeShopNotificationItems,
  parseShopNotificationPayload,
  type ShopCenterNotifItem,
} from "@/lib/shopee-shop-notification-parse";

function notifCreatedAtMs(it: ShopCenterNotifItem): number {
  const d = it.createdAt;
  if (d == null) return 0;
  if (d instanceof Date) return d.getTime();
  const t = new Date(d as string | number).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 接続済み全店舗の Seller Center 通知を先頭ページ分マージ（MY / SG など複数店舗で一覧に表示）
 */
async function mergeNotificationsFromAllShops(
  shops: { shop_id: number; country: string }[],
  pageSizePerShop: number
): Promise<{
  merged: ShopCenterNotifItem[];
  unreadSum: number;
  shopIds: number[];
}> {
  const merged: ShopCenterNotifItem[] = [];
  let unreadSum = 0;
  for (const s of shops) {
    const country = s.country?.trim();
    const accessToken = await getValidToken(s.shop_id);
    const data = await getShopNotification(
      accessToken,
      s.shop_id,
      { page_size: pageSizePerShop },
      country ? { country } : undefined
    );
    const json = {
      shop_id: s.shop_id,
      ...(data as Record<string, unknown>),
    } as Record<string, unknown>;
    const parsed = parseShopNotificationPayload(json);
    if (parsed.serverUnreadTotal !== undefined) {
      unreadSum += parsed.serverUnreadTotal;
    }
    const code = country ? country.toUpperCase() : undefined;
    for (const it of parsed.items) {
      merged.push({
        ...it,
        shopId: s.shop_id,
        ...(code ? { country: code } : {}),
      });
    }
  }
  merged.sort((a, b) => notifCreatedAtMs(b) - notifCreatedAtMs(a));
  return {
    merged: dedupeShopNotificationItems(merged),
    unreadSum,
    shopIds: shops.map((x) => x.shop_id),
  };
}

/**
 * GET /api/shopee/shop-notifications
 * Shopee Seller Center 通知 API（get_shop_notification）のプロキシ。
 *
 * Query:
 * - shop_id（任意）未指定時は接続済み先頭店舗
 * - cursor（任意）前回レスポンスの cursor
 * - page_size（任意）1〜50
 *
 * 未指定かつ `shop_id` も無く、接続が2店舗以上のときは **全店舗** の通知をマージして返す（`multi_shop: true`）。
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

    const multiShopFirstPage =
      !shopIdParam && !cursor && shops.length > 1;

    if (multiShopFirstPage) {
      const base =
        page_size != null && Number.isFinite(page_size) ? page_size : 20;
      const per = Math.min(
        50,
        Math.max(5, Math.ceil(base / Math.max(1, shops.length)))
      );
      const { merged, unreadSum, shopIds } = await mergeNotificationsFromAllShops(
        shops,
        per
      );
      return NextResponse.json({
        shop_id: shops[0].shop_id,
        multi_shop: true,
        chapee_merged_items: merged,
        chapee_server_unread_total: unreadSum,
        chapee_shop_ids: shopIds,
      });
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

    const countryCode = country ? String(country).toUpperCase() : undefined;
    return NextResponse.json({
      shop_id: shopId,
      ...(countryCode ? { chapee_shop_country: countryCode } : {}),
      ...data,
    });
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

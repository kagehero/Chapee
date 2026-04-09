import { getItemBaseInfo, getOrderDetail, type ShopeeApiOptions } from "./shopee-api";
import { pickOrderItemImageUrl } from "./shopee-order-utils";

export type ItemCatalogEntry = { name?: string; image_url?: string };

/** `get_item_base_info` のレスポンスから item_id → 表示用フィールド */
export function itemCatalogMapFromItemBaseInfoResponse(
  data: Record<string, unknown>
): Map<number, ItemCatalogEntry> {
  const map = new Map<number, ItemCatalogEntry>();
  const r = data.response as Record<string, unknown> | undefined;
  const list = (r?.item_list ?? r?.items ?? []) as unknown[];
  if (!Array.isArray(list)) return map;
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const it = raw as Record<string, unknown>;
    const n = Number(it.item_id);
    if (!Number.isFinite(n) || n <= 0) continue;
    const nameRaw = it.item_name;
    const name =
      typeof nameRaw === "string" && nameRaw.trim().length > 0
        ? nameRaw.trim()
        : undefined;
    const image_url = pickOrderItemImageUrl(it);
    map.set(n, { name, image_url });
  }
  return map;
}

export type OrderItemInfo = {
  item_name?: string;
  item_image_url?: string;
  item_id?: string;
};

/**
 * 注文 SN 一覧から注文内の商品名・画像を取得（50 件ずつ）
 * チャット内の order カードに商品サムネを表示するために使う。
 */
export async function fetchOrderItemInfoMap(
  accessToken: string,
  shopId: number,
  orderSnList: string[],
  options?: ShopeeApiOptions
): Promise<Map<string, OrderItemInfo>> {
  const out = new Map<string, OrderItemInfo>();
  const uniq = [...new Set(orderSnList.map((s) => s.trim()).filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    try {
      const data = (await getOrderDetail(
        accessToken,
        shopId,
        chunk,
        ["item_list"],
        options
      )) as Record<string, unknown>;
      const r = data.response as Record<string, unknown> | undefined;
      const orderList = (r?.order_list ?? []) as unknown[];
      for (const raw of orderList) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const o = raw as Record<string, unknown>;
        const sn = typeof o.order_sn === "string" ? o.order_sn.trim() : "";
        if (!sn) continue;
        const itemList = o.item_list;
        if (!Array.isArray(itemList) || itemList.length === 0) continue;
        const first = itemList[0] as Record<string, unknown>;
        const item_name =
          typeof first.item_name === "string" && first.item_name.trim()
            ? first.item_name.trim()
            : typeof first.name === "string" && first.name.trim()
              ? first.name.trim()
              : undefined;
        const item_image_url = pickOrderItemImageUrl(first);
        const item_id =
          first.item_id != null ? String(first.item_id) : undefined;
        out.set(sn, { item_name, item_image_url, item_id });
      }
    } catch (e) {
      console.warn("[fetchOrderItemInfoMap] get_order_detail failed", e);
    }
  }
  return out;
}

/**
 * 会話内の item_id 一覧から商品名・画像をまとめて取得（50 件ずつ）
 */
export async function fetchItemCatalogMapByIds(
  accessToken: string,
  shopId: number,
  itemIds: number[],
  options?: ShopeeApiOptions
): Promise<Map<number, ItemCatalogEntry>> {
  const out = new Map<number, ItemCatalogEntry>();
  const uniq = [...new Set(itemIds.map((n) => Math.floor(Number(n))))].filter(
    (n) => Number.isFinite(n) && n > 0
  );
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    try {
      const data = await getItemBaseInfo(accessToken, shopId, chunk, options);
      const m = itemCatalogMapFromItemBaseInfoResponse(data);
      for (const [k, v] of m) out.set(k, v);
    } catch (e) {
      console.warn("[fetchItemCatalogMapByIds] get_item_base_info failed", e);
    }
  }
  return out;
}

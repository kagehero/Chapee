import { getItemBaseInfo, type ShopeeApiOptions } from "./shopee-api";
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

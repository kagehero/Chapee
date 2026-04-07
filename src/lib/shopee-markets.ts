/**
 * Shopee Seller / Open API で扱うマーケットコード（UI フィルタ・担当者割当等で共通利用）
 */
export const SHOPEE_MARKET_CODES = [
  "SG",
  "PH",
  "MY",
  "TW",
  "TH",
  "ID",
  "VN",
  "BR",
] as const;

export type ShopeeMarketCode = (typeof SHOPEE_MARKET_CODES)[number];

/** ダッシュボード・チャット一覧の「全て + 各国」チップ用 */
export function marketFilterChipsWithAll(): string[] {
  return ["全て", ...SHOPEE_MARKET_CODES];
}

/** 新規スタッフのデフォルト担当国（全マーケット＝シンガポール店と同等に MY 店も扱える） */
export function defaultStaffMarketCountries(): string[] {
  return [...SHOPEE_MARKET_CODES];
}

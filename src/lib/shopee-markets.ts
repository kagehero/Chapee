/**
 * Shopee 対応マーケット（7か国）
 * SG / PH / MY / TW / TH / VN / BR
 *
 * UI のフィルタ・OAuth・担当者割当はこの一覧に合わせる。
 * `shopee-order-utils` のホストマップはレガシー用に ID 等を残す場合がある。
 */
export const SHOPEE_MARKET_CODES = [
  "SG",
  "PH",
  "MY",
  "TW",
  "TH",
  "VN",
  "BR",
] as const;

export type ShopeeMarketCode = (typeof SHOPEE_MARKET_CODES)[number];

/** 設定画面のドロップダウン等（コード + 表示名） */
export const SHOPEE_MARKET_OPTIONS: { code: string; name: string }[] = [
  { code: "SG", name: "Singapore" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "BR", name: "Brazil" },
];

/** ダッシュボード・チャット一覧の「全て + 各国」チップ用 */
export function marketFilterChipsWithAll(): string[] {
  return ["全て", ...SHOPEE_MARKET_CODES];
}

/** 新規スタッフのデフォルト担当国（7か国すべて） */
export function defaultStaffMarketCountries(): string[] {
  return [...SHOPEE_MARKET_CODES];
}

/**
 * チャット同期（POST /api/shopee/sync）後にヘッダーの Seller Center 通知を更新するためのブラウザイベント。
 */
export const CHAPEE_SHOP_NOTIFICATIONS_REFRESH =
  "chapee:shop-notifications-refresh" as const;

export type ShopNotificationsRefreshDetail = {
  /** 同期レスポンスの delta.new_notification_ids 件数の合計（全店舗） */
  newNotificationIdsTotal?: number;
};

export function dispatchShopNotificationsRefresh(
  detail?: ShopNotificationsRefreshDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHAPEE_SHOP_NOTIFICATIONS_REFRESH, {
      detail: (detail ?? {}) as ShopNotificationsRefreshDetail,
    })
  );
}

export function sumNewNotificationIdsFromSyncResults(
  results:
    | Array<{
        error?: string;
        delta?: { new_notification_ids?: string[] };
      }>
    | undefined
): number {
  if (!results?.length) return 0;
  let n = 0;
  for (const r of results) {
    if (r.error) continue;
    const ids = r.delta?.new_notification_ids;
    if (Array.isArray(ids)) n += ids.length;
  }
  return n;
}

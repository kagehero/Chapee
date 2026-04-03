/**
 * Chapee 内で Seller Center 通知を「読んだ」状態を保持し、ヘッダー未読数と同期する。
 * Shopee API に既読 API がない前提で、ローカルで未読オフセットを管理する。
 */

const MAX_READ_IDS = 800;

export type ShopNotifPersistedRead = {
  readIds: string[];
  /** Chapee 内で新規に既読にした件数（serverUnreadTotal から減算する） */
  localReadCount: number;
  /** 直近の API 未読総数（サーバが減ったときに localReadCount を補正する） */
  lastServerUnread: number | undefined;
};

function defaultState(): ShopNotifPersistedRead {
  return { readIds: [], localReadCount: 0, lastServerUnread: undefined };
}

export function shopNotifReadStorageKey(shopId: number): string {
  return `chapee:shop-notifications-read-v1:${shopId}`;
}

export function loadShopNotifReadState(shopId: number): ShopNotifPersistedRead {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(shopNotifReadStorageKey(shopId));
    if (!raw) return defaultState();
    const o = JSON.parse(raw) as Record<string, unknown>;
    const readIds = Array.isArray(o.readIds)
      ? o.readIds.map((x) => String(x))
      : [];
    const localReadCount =
      typeof o.localReadCount === "number" && Number.isFinite(o.localReadCount)
        ? Math.max(0, Math.floor(o.localReadCount))
        : 0;
    const lastServerUnread =
      typeof o.lastServerUnread === "number" && Number.isFinite(o.lastServerUnread)
        ? Math.max(0, Math.floor(o.lastServerUnread))
        : undefined;
    return { readIds, localReadCount, lastServerUnread };
  } catch {
    return defaultState();
  }
}

export function saveShopNotifReadState(
  shopId: number,
  state: ShopNotifPersistedRead
): void {
  if (typeof window === "undefined") return;
  try {
    const readIds =
      state.readIds.length > MAX_READ_IDS
        ? state.readIds.slice(-MAX_READ_IDS)
        : state.readIds;
    localStorage.setItem(
      shopNotifReadStorageKey(shopId),
      JSON.stringify({
        readIds,
        localReadCount: state.localReadCount,
        lastServerUnread: state.lastServerUnread,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * API の未読総数が更新されたとき、Shopee 側で既読になった分だけ localReadCount を減らす。
 */
export function adjustLocalReadCountForServerUnread(
  prev: ShopNotifPersistedRead,
  serverUnread: number | undefined
): ShopNotifPersistedRead {
  if (serverUnread === undefined) return prev;
  const last = prev.lastServerUnread;
  let nextCount = prev.localReadCount;
  if (last !== undefined && serverUnread < last) {
    nextCount = Math.max(0, nextCount - (last - serverUnread));
  }
  return {
    ...prev,
    localReadCount: nextCount,
    lastServerUnread: serverUnread,
  };
}

/**
 * 通知を Chapee で既読にしたとき。同一 ID は 1 回だけカウント。
 */
export function markShopNotificationReadInChapee(
  shopId: number,
  notificationId: string,
  current: ShopNotifPersistedRead
): ShopNotifPersistedRead {
  if (current.readIds.includes(notificationId)) return current;
  const readIds = [...current.readIds, notificationId];
  const trimmed =
    readIds.length > MAX_READ_IDS ? readIds.slice(-MAX_READ_IDS) : readIds;
  return {
    ...current,
    readIds: trimmed,
    localReadCount: current.localReadCount + 1,
  };
}

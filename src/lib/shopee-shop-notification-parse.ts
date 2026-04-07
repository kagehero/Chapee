/**
 * Shopee v2.shop.get_shop_notification レスポンスのパース（サーバー・クライアント共通）
 */

export type ShopCenterNotifItem = {
  id: string;
  title: string;
  content: string;
  /** クライアントで API JSON を受け取ると ISO 文字列にシリアライズされる */
  createdAt?: Date | string;
  url?: string;
  /** API が既読を返す場合のみ。未設定は「不明」 */
  isRead?: boolean;
  /** 複数店舗連携時、通知がどの shop に属するか */
  shopId?: number;
  /** マーケットコード（例: SG, MY）— 一覧で国別表示用 */
  country?: string;
};

/** Shopee が同一 notification_id を複数返すことがあるため、先勝ちで一意化（店舗またぎは shopId を含める） */
export function dedupeShopNotificationItems(
  items: ShopCenterNotifItem[]
): ShopCenterNotifItem[] {
  const seen = new Set<string>();
  const out: ShopCenterNotifItem[] = [];
  for (const item of items) {
    const key =
      item.shopId != null ? `${item.shopId}:${item.id}` : item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function parseNonNegativeInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return undefined;
}

/** 通知オブジェクトから既読を推定（フィールド名の揺れに対応） */
function inferItemRead(o: Record<string, unknown>): boolean | undefined {
  if (o.is_read === true) return true;
  if (o.is_read === false) return false;
  if (o.read === 1 || o.read === "1") return true;
  if (o.read === 0 || o.read === "0") return false;
  const rs = o.read_status;
  if (rs === "unread" || rs === 0 || rs === "0") return false;
  if (rs === "read" || rs === 1 || rs === "1") return true;
  if (o.read_flag === 1) return true;
  if (o.read_flag === 0) return false;
  const st = o.status;
  if (st === "read" || st === 1 || st === "1") return true;
  if (st === "unread" || st === 0 || st === "0") return false;
  return undefined;
}

/** Shopee get_shop_notification が返す未読総数（response のネストに対応） */
const UNREAD_TOTAL_KEYS = [
  "unread_count",
  "total_unread",
  "unread_number",
  "total_unread_count",
  "notification_unread_count",
  "noti_unread_count",
  "notification_unread_num",
  "total_unread_num",
] as const;

function extractUnreadFromRecord(obj: Record<string, unknown>): number | undefined {
  for (const k of UNREAD_TOTAL_KEYS) {
    const n = parseNonNegativeInt(obj[k]);
    if (n !== undefined) return n;
  }
  return undefined;
}

function extractServerUnreadTotal(
  root: Record<string, unknown>,
  resp: Record<string, unknown>
): number | undefined {
  const direct =
    extractUnreadFromRecord(root) ?? extractUnreadFromRecord(resp);
  if (direct !== undefined) return direct;

  const nestedResp = resp.response;
  if (
    nestedResp &&
    typeof nestedResp === "object" &&
    !Array.isArray(nestedResp)
  ) {
    const n = extractUnreadFromRecord(nestedResp as Record<string, unknown>);
    if (n !== undefined) return n;
  }

  const nestedRoot = root.response;
  if (
    nestedRoot &&
    typeof nestedRoot === "object" &&
    !Array.isArray(nestedRoot) &&
    nestedRoot !== resp
  ) {
    const n = extractUnreadFromRecord(nestedRoot as Record<string, unknown>);
    if (n !== undefined) return n;
  }

  for (const v of Object.values(resp)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const n = extractUnreadFromRecord(v as Record<string, unknown>);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

/** Shopee get_shop_notification のレスポンス（response 形の揺れに対応） */
export function parseShopNotificationPayload(
  json: Record<string, unknown>
): {
  items: ShopCenterNotifItem[];
  nextCursor?: string | number;
  shopId?: number;
  serverUnreadTotal?: number;
} {
  const shopId =
    typeof json.shop_id === "number"
      ? json.shop_id
      : typeof json.shop_id === "string"
        ? Number(json.shop_id)
        : undefined;

  const root = json;
  const resp = (root.response as Record<string, unknown>) ?? root;

  const serverUnreadTotal = extractServerUnreadTotal(root, resp);

  const nextCursor =
    (resp.cursor as string | number | undefined) ??
    (root.cursor as string | number | undefined);

  const list: unknown[] = [];

  const arr =
    resp.notification_list ??
    resp.noti_list ??
    resp.notification_list_v2 ??
    resp.list;
  if (Array.isArray(arr)) {
    list.push(...arr);
  } else if (resp.data != null) {
    const d = resp.data;
    if (Array.isArray(d)) list.push(...d);
    else if (typeof d === "object") list.push(d);
  }

  const items: ShopCenterNotifItem[] = list.map((raw, idx) => {
    const o = raw as Record<string, unknown>;
    const id = String(
      o.notification_id ??
        o.noti_id ??
        o.id ??
        `n-${idx}-${String(o.title ?? o.create_time ?? "")}`
    );
    const title = String(o.title ?? o.subject ?? "通知").trim() || "通知";
    const content = String(
      o.content ?? o.message ?? o.body ?? o.text ?? ""
    ).trim();
    const urlRaw = o.url ?? o.redirect_url ?? o.link;
    const url =
      typeof urlRaw === "string" && /^https?:\/\//i.test(urlRaw.trim())
        ? urlRaw.trim()
        : undefined;

    let createdAt: Date | undefined;
    const ts = o.create_time ?? o.created_time ?? o.timestamp ?? o.time;
    if (typeof ts === "number" && Number.isFinite(ts)) {
      createdAt = new Date(ts > 1e12 ? ts : ts * 1000);
    } else if (typeof ts === "string" && /^\d+$/.test(ts)) {
      const n = Number(ts);
      createdAt = new Date(n > 1e12 ? n : n * 1000);
    }

    const isRead = inferItemRead(o);

    return {
      id,
      title,
      content,
      createdAt,
      url,
      ...(Number.isFinite(shopId) ? { shopId } : {}),
      ...(isRead !== undefined ? { isRead } : {}),
    };
  });

  return {
    items,
    nextCursor:
      nextCursor !== undefined && nextCursor !== null && nextCursor !== ""
        ? nextCursor
        : undefined,
    shopId: Number.isFinite(shopId) ? shopId : undefined,
    serverUnreadTotal,
  };
}

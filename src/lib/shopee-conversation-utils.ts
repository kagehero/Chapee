/**
 * Shopee sellerchat payloads use nanosecond timestamps in some fields.
 */
export function shopeeNanoTimestampToDate(ts: number | string | undefined): Date {
  if (ts === undefined || ts === null) return new Date();
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (!Number.isFinite(n) || n <= 0) return new Date();
  if (n > 1e17) return new Date(Math.floor(n / 1e6));
  if (n > 1e12) return new Date(n);
  return new Date(n * 1000);
}

type LatestContent = { text?: string } | null | undefined;

export function previewFromConversationListItem(conv: {
  latest_message_type?: string;
  latest_message_content?: LatestContent;
}): string {
  const text = conv.latest_message_content?.text?.trim();
  if (text) return text.length > 500 ? `${text.slice(0, 500)}…` : text;
  const t = conv.latest_message_type || "message";
  return `[${t}]`;
}

export type UiChatType = "buyer" | "notification" | "affiliate";

/**
 * 会話オブジェクト（一覧・get_one_conversation）からバイヤー顔写真 URL を推定
 */
export function extractBuyerAvatarFromShopee(conv: Record<string, unknown>): string | undefined {
  const tryKeys = (o: Record<string, unknown>): string | undefined => {
    const keys = [
      "to_avatar",
      "to_avatar_url",
      "buyer_avatar",
      "buyer_avatar_url",
      "user_portrait",
      "portrait",
      "profile_image",
      "profile_image_url",
      "avatar",
      "avatar_url",
      "to_profile_image",
      "to_user_avatar",
      "user_avatar",
      "image",
    ];
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
    }
    return undefined;
  };

  const direct = tryKeys(conv);
  if (direct) return direct;

  const nested = conv.to_user;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = tryKeys(nested as Record<string, unknown>);
    if (n) return n;
  }

  const buyer = conv.buyer;
  if (buyer && typeof buyer === "object" && !Array.isArray(buyer)) {
    const n = tryKeys(buyer as Record<string, unknown>);
    if (n) return n;
  }

  return undefined;
}

/** get_shop_info レスポンスから店舗ロゴ URL */
export function extractShopLogoFromShopInfo(data: Record<string, unknown>): string | undefined {
  const r = data.response as Record<string, unknown> | undefined;
  const shop = (r?.shop ?? r) as Record<string, unknown> | undefined;
  if (!shop) return undefined;
  const keys = [
    "shop_logo",
    "logo_url",
    "logo",
    "logo_img",
    "cover",
    "cover_image",
    "profile_image",
    "profile_image_url",
  ];
  for (const k of keys) {
    const v = shop[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return undefined;
}

/** システム通知系カードのみ（通常バイヤーチャットの order 通知は除外） */
const NOTIFICATION_ONLY_MESSAGE_TYPES = new Set([
  "return_refund_card",
  "out_of_stock_reminder_card",
  "faq_liveagent_prompt",
]);

/**
 * チャット種別（一覧の「通知」タブ用）
 * order_notification / system だけでは一般バイヤー会話も拾うため含めない。
 */
export function inferChatTypeFromShopee(conv: {
  latest_message_type?: string;
  to_name?: string;
}): UiChatType {
  const name = (conv.to_name || "").toLowerCase();
  const mt = (conv.latest_message_type || "").toLowerCase();
  if (name.includes("shopee") && name.includes("通知")) return "notification";
  if (NOTIFICATION_ONLY_MESSAGE_TYPES.has(mt)) return "notification";
  if (mt.includes("affiliate")) return "affiliate";
  return "buyer";
}

/**
 * バイヤー / 当店の判定（shop_id・バイヤーID と from_id を突き合わせ）
 */
export function inferChatMessageSender(
  msg: Record<string, unknown>,
  shopId: number,
  buyerUserId: number
): "staff" | "customer" {
  const shop = Number(shopId);
  const buyer = Number(buyerUserId);
  const fromId = Number(msg.from_id ?? msg.from_user_id ?? 0);
  if (Number.isFinite(shop) && fromId === shop) return "staff";
  if (buyer > 0 && Number.isFinite(buyer) && fromId === buyer) return "customer";
  const fromShop = msg.from_shop_id ?? msg.sender_shop_id;
  if (fromShop != null && Number(fromShop) === shop) return "staff";
  // from_id が店舗でなければバイヤー側扱い（システム・相手）
  if (fromId !== 0 && fromId !== shop) return "customer";
  return "customer";
}

/** 当店側メッセージが自動返信っぽいか（Shopee が返す message_type 依存・推定） */
export function inferStaffMessageAutoHint(msg: Record<string, unknown>): boolean {
  const mt = String(msg.message_type ?? msg.type ?? "").toLowerCase();
  return (
    mt.includes("auto_reply") ||
    mt.includes("autoreply") ||
    mt.includes("auto-reply") ||
    (mt.includes("system") && mt.includes("reply"))
  );
}

/** Timestamp from Shopee `get_message` row (seconds, ms, or ns). */
export function shopeeMessageTimeToMs(ts: unknown): number {
  if (ts == null) return Date.now();
  const n = Number(ts);
  if (!Number.isFinite(n)) return Date.now();
  if (n > 1e17) return Math.floor(n / 1e6);
  if (n > 1e12) return n;
  return n * 1000;
}

/** UI 用（商品カード・注文・スタンプなど） */
export type ShopeeMessageCardKind = "text" | "item" | "order" | "sticker" | "image";

export type ShopeeMessageDisplay = {
  kind: ShopeeMessageCardKind;
  /** 一覧・フォールバック用の一行 */
  summary: string;
  item?: {
    item_id?: string;
    name?: string;
    image_url?: string;
    shop_id?: string;
    /** 注文カードではなく商品を出すとき、紐づく注文があれば補足表示用 */
    related_order_sn?: string;
  };
  order?: { order_sn?: string };
  sticker?: {
    image_url?: string;
    sticker_id?: string;
    package_id?: string;
  };
  image?: { url?: string };
};

function absorbJsonObject(target: Record<string, unknown>, raw: unknown): void {
  if (raw == null) return;
  if (typeof raw === "string") {
    const s = raw.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        const j = JSON.parse(s) as unknown;
        if (j && typeof j === "object" && !Array.isArray(j)) {
          Object.assign(target, j as Record<string, unknown>);
        }
      } catch {
        /* plain string */
      }
    }
    return;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    Object.assign(target, raw as Record<string, unknown>);
  }
}

function assignIfObject(
  flat: Record<string, unknown>,
  raw: unknown
): void {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.assign(flat, raw as Record<string, unknown>);
  }
}

/**
 * Shopee は商品カードを `content.item` / `item_card` 等にネストして返すことがある。
 * ルート直下の `item` だけでは item_id が取れないため、ネストをフラットに寄せる。
 */
function mergeNestedItemLikeIntoFlat(
  flat: Record<string, unknown>,
  obj: unknown,
  depth: number
): void {
  if (depth <= 0 || obj == null || typeof obj !== "object" || Array.isArray(obj)) return;
  const o = obj as Record<string, unknown>;
  for (const key of [
    "item",
    "item_card",
    "item_info",
    "product",
    "product_card",
    "goods",
  ]) {
    assignIfObject(flat, o[key]);
  }
}

/** message / content をフラット化（JSON 文字列も展開）してキー検索しやすくする */
export function flattenShopeeChatPayload(msg: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...msg };
  absorbJsonObject(flat, msg.message);
  absorbJsonObject(flat, msg.content);
  const item = msg.item;
  if (item && typeof item === "object" && !Array.isArray(item)) {
    Object.assign(flat, item as Record<string, unknown>);
  }
  assignIfObject(flat, msg.item_card);
  assignIfObject(flat, msg.item_info);
  assignIfObject(flat, msg.product);
  mergeNestedItemLikeIntoFlat(flat, msg.message, 2);
  mergeNestedItemLikeIntoFlat(flat, msg.content, 2);
  const sticker = msg.sticker;
  if (sticker && typeof sticker === "object" && !Array.isArray(sticker)) {
    Object.assign(flat, sticker as Record<string, unknown>);
  }
  const order = msg.order;
  if (order && typeof order === "object" && !Array.isArray(order)) {
    const orec = order as Record<string, unknown>;
    Object.assign(flat, orec);
    const il = orec.item_list;
    if (Array.isArray(il) && il.length > 0 && il[0] && typeof il[0] === "object") {
      Object.assign(flat, il[0] as Record<string, unknown>);
    }
  }
  return flat;
}

/** 本文・リンクに含まれる Shopee 商品 URL から item_id / shop_id を拾う */
function extractProductIdsFromText(text: string | undefined): {
  shop_id?: string;
  item_id?: string;
} {
  if (!text || !text.trim()) return {};
  const m = text.match(/\/product\/(\d+)\/(\d+)/);
  if (m) {
    return { shop_id: m[1], item_id: m[2] };
  }
  return {};
}

function findOrderSnDeep(obj: unknown): string | undefined {
  if (obj == null) return undefined;
  if (typeof obj === "string") {
    const s = obj.trim();
    if (/^[A-Z0-9]{10,}$/.test(s)) return s;
    return undefined;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const f = findOrderSnDeep(x);
      if (f) return f;
    }
    return undefined;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const kl = k.toLowerCase();
      if (
        (kl === "order_sn" || kl === "ordersn") &&
        typeof v === "string" &&
        v.trim().length >= 8
      ) {
        return v.trim();
      }
      const f = findOrderSnDeep(v);
      if (f) return f;
    }
  }
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/** 画像 URL（スタンプ・商品サムネ等）を優先度付きで取得 */
function pickImageUrlFromPayload(
  flat: Record<string, unknown>,
  msg: Record<string, unknown>,
  messageTypeLower: string
): string | undefined {
  const keys = [
    "sticker_url",
    "sticker_preview_url",
    "preview_image_url",
    "image_url",
    "thumb_url",
    "thumbnail_url",
    "image",
    "thumb",
    "url",
    "cover_image",
    "item_image",
  ];
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  }
  const ii = flat.image_info;
  if (ii && typeof ii === "object" && !Array.isArray(ii)) {
    const io = ii as Record<string, unknown>;
    const list = io.image_url_list;
    if (Array.isArray(list) && list[0] && typeof list[0] === "string") {
      const u = list[0].trim();
      if (/^https?:\/\//i.test(u)) return u;
    }
    const single = io.image_url ?? io.thumbnail_url;
    if (typeof single === "string" && /^https?:\/\//i.test(single)) return single;
  }
  const imgBlock = flat.image;
  if (imgBlock && typeof imgBlock === "object" && !Array.isArray(imgBlock)) {
    const io = imgBlock as Record<string, unknown>;
    const list = io.image_url_list;
    if (Array.isArray(list) && list[0] && typeof list[0] === "string") {
      const u = list[0].trim();
      if (/^https?:\/\//i.test(u)) return u;
    }
    const single = io.image_url ?? io.thumbnail_url;
    if (typeof single === "string" && /^https?:\/\//i.test(single)) return single;
  }
  const walkUrls = (o: unknown): string[] => {
    const out: string[] = [];
    const w = (x: unknown) => {
      if (x == null) return;
      if (typeof x === "string" && /^https?:\/\//i.test(x)) out.push(x);
      else if (Array.isArray(x)) x.forEach(w);
      else if (typeof x === "object") Object.values(x as Record<string, unknown>).forEach(w);
    };
    w(o);
    return out;
  };
  const all = [...walkUrls(flat), ...walkUrls(msg.message), ...walkUrls(msg.content)];
  const stickerish = all.find((u) => /sticker|emot|cdn.*shopee/i.test(u));
  if (stickerish) return stickerish;
  const productish = all.find((u) => /item|product|image|cf\.shopee|down-cdn/i.test(u));
  if (productish) return productish;
  if (messageTypeLower.includes("sticker") && all[0]) return all[0];
  return all[0];
}

/**
 * Shopee `get_message` 1 行を UI 向けに分解（item / order / sticker 等）
 */
export function displayFromShopeeChatMessage(msg: Record<string, unknown>): ShopeeMessageDisplay {
  const flat = flattenShopeeChatPayload(msg);
  const mtRaw = String(msg.message_type ?? msg.type ?? flat.message_type ?? flat.type ?? "");
  const mt = mtRaw.toLowerCase();

  const plainTextEarly = (): string | undefined => {
    const m = msg.message;
    if (typeof m === "string" && m.trim() && !m.trim().startsWith("{")) return m.trim();
    if (m && typeof m === "object" && "text" in m && typeof (m as { text?: string }).text === "string") {
      const t = (m as { text: string }).text;
      if (t.trim()) return t;
    }
    const content = msg.content;
    if (typeof content === "string" && content.trim() && !content.trim().startsWith("{")) {
      return content.trim();
    }
    if (content && typeof content === "object" && "text" in (content as object)) {
      const t = (content as { text?: string }).text;
      if (typeof t === "string" && t.trim()) return t;
    }
    const ft = pickString(flat, ["text", "message", "content"]);
    if (ft && !ft.startsWith("{")) return ft;
    return undefined;
  };

  const explicitOrderSn = pickString(flat, ["order_sn", "ordersn"]);
  let orderSn = explicitOrderSn;
  if (!orderSn && (mt.includes("order") || mt.includes("notification"))) {
    orderSn = findOrderSnDeep(flat) ?? findOrderSnDeep(msg);
  }

  let resolvedItemId = pickString(flat, [
    "item_id",
    "itemid",
    "item_id_str",
    "itemid_str",
  ]);
  const itemName = pickString(flat, [
    "item_name",
    "name",
    "item_title",
    "title",
    "product_name",
    "product_title",
  ]);
  let resolvedShopId = pickString(flat, ["shop_id", "shopid"]);
  const textBlob = [plainTextEarly(), pickString(flat, ["text"])].filter(Boolean).join("\n");
  const fromUrl = extractProductIdsFromText(textBlob);
  if (!resolvedItemId && fromUrl.item_id) resolvedItemId = fromUrl.item_id;
  if (!resolvedShopId && fromUrl.shop_id) resolvedShopId = fromUrl.shop_id;

  const itemNameResolved =
    itemName || (mt.includes("item") ? pickString(flat, ["text"]) : undefined);
  const img = pickImageUrlFromPayload(flat, msg, mt);

  /** message_type が数値や別名でも、sticker 系フィールドがあればスタンプとして扱う */
  const hasStickerShape =
    !!pickString(flat, ["sticker_id", "stickerid"]) ||
    !!pickString(flat, ["sticker_package_id", "package_id", "sticker_packageid"]);

  if (hasStickerShape || mt.includes("sticker") || mt.includes("emotion")) {
    return {
      kind: "sticker",
      summary: "スタンプ",
      sticker: {
        image_url: img,
        sticker_id: pickString(flat, ["sticker_id", "stickerid"]),
        package_id: pickString(flat, [
          "sticker_package_id",
          "package_id",
          "sticker_packageid",
        ]),
      },
    };
  }

  /**
   * 注文カードより商品カードを優先（未購入の問い合わせでは注文番号より商品が重要）
   */
  const looksLikeProductMessage =
    mt.includes("item") ||
    mt.includes("item_card") ||
    mt.includes("product") ||
    mt.includes("product_card") ||
    mt.includes("inquiry") ||
    mt.includes("listing") ||
    !!resolvedItemId ||
    !!itemName ||
    !!itemNameResolved;

  /** 商品を主表示にしつつ、注文文脈が明確なときだけ注文番号を補足する */
  const showRelatedOrderSn =
    !!orderSn &&
    (!!explicitOrderSn ||
      mt.includes("order_notification") ||
      mt.includes("order_card") ||
      (mt.includes("order") && mt.includes("notification")));

  if (looksLikeProductMessage) {
    return {
      kind: "item",
      summary: itemNameResolved
        ? `商品: ${itemNameResolved}`
        : resolvedItemId
          ? `商品 (item_id: ${resolvedItemId})`
          : "商品",
      item: {
        item_id: resolvedItemId,
        name: itemNameResolved,
        image_url: img,
        shop_id: resolvedShopId,
        ...(showRelatedOrderSn ? { related_order_sn: orderSn } : {}),
      },
    };
  }

  if (mt.includes("order") || mt.includes("order_notification") || orderSn) {
    return {
      kind: "order",
      summary: orderSn ? `注文番号: ${orderSn}` : "注文情報",
      order: { order_sn: orderSn },
    };
  }

  if (mt.includes("image") || mt.includes("photo") || mt.includes("picture")) {
    const url = img;
    return {
      kind: "image",
      summary: url ? "画像" : "画像",
      image: { url },
    };
  }

  const text = plainTextEarly();
  if (text) {
    return { kind: "text", summary: text };
  }

  return {
    kind: "text",
    summary:
      typeof mtRaw === "string" && mtRaw
        ? `[${mtRaw}]`
        : typeof msg.message_type === "number"
          ? `[${msg.message_type}]`
          : "",
  };
}

/** Normalize a single chat message payload from Shopee `get_message` into display text */
export function textFromShopeeChatMessage(msg: Record<string, unknown>): string {
  return displayFromShopeeChatMessage(msg).summary;
}

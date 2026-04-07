import crypto from "crypto";

const PARTNER_ID = parseInt(process.env.SHOPEE_PARTNER_ID || "0");
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";

/** 店舗の `country`（OAuth の `country` / DB の `shopee_tokens.country`）に応じた Partner API ホスト */
export type ShopeeApiOptions = { country?: string };

/**
 * Partner API のベース URL。
 * - `SHOPEE_PARTNER_API_HOST` が最優先（例: サンドボックスやドキュメント記載の地域ホスト）
 * - 無ければ `SHOPEE_PARTNER_API_ENV=sandbox|test|test-stable|uat` で test-stable
 * - BR 店舗は `openplatform.shopee.com.br`（グローバル host だと order 系が 404 になることがある）
 * @see https://open.shopee.com/documents/v2/Developer%20Guide?module
 */
export function getShopeeBaseUrl(country?: string): string {
  const explicit = process.env.SHOPEE_PARTNER_API_HOST?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const env = process.env.SHOPEE_PARTNER_API_ENV?.trim().toLowerCase();
  if (
    env === "sandbox" ||
    env === "test" ||
    env === "test-stable" ||
    env === "uat"
  ) {
    return "https://partner.test-stable.shopeemobile.com";
  }
  const c = (country || "").trim().toUpperCase();
  if (c === "BR") {
    return "https://openplatform.shopee.com.br";
  }
  return "https://partner.shopeemobile.com";
}

/**
 * Generate HMAC-SHA256 signature for Shopee API requests
 */
function generateSignature(
  path: string,
  timestamp: number,
  accessToken?: string,
  shopId?: number
): string {
  let baseString = `${PARTNER_ID}${path}${timestamp}`;

  if (accessToken && shopId) {
    baseString += `${accessToken}${shopId}`;
  }

  return crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(baseString)
    .digest("hex");
}

/** プロキシや Shopee 側で HTML / 空ボディが返る場合があるため、text → JSON.parse で扱う */
async function parseShopeeResponseJson(
  response: Response,
  context: string
): Promise<Record<string, unknown>> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`${context}: empty body (HTTP ${response.status})`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${context}: not JSON (HTTP ${response.status}): ${trimmed.slice(0, 280)}`
    );
  }
}

/**
 * Exchange authorization code for access token
 */
export async function getAccessToken(
  code: string,
  shopId: number,
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp);
  const base = getShopeeBaseUrl(options?.country);

  const url = `${base}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      shop_id: shopId,
      partner_id: PARTNER_ID,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expire_in: data.expire_in,
    shop_id: shopId,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  shopId: number,
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp);
  const base = getShopeeBaseUrl(options?.country);

  const url = `${base}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: refreshToken,
      shop_id: shopId,
      partner_id: PARTNER_ID,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expire_in: data.expire_in,
    shop_id: shopId,
  };
}

/**
 * Get shop information
 */
export async function getShopInfo(
  accessToken: string,
  shopId: number,
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/shop/get_shop_info";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${accessToken}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Seller Center の通知一覧（v2.shop.get_shop_notification）
 * @see https://open.shopee.com/documents/v2/v2.shop.get_shop_notification
 *
 * Shopee 公式 SDK は本 API を **GET**（クエリに page_size / cursor）で呼び出します。
 * POST だと環境によって 404 HTML が返ることがあるため GET のみ使用します。
 */
export async function getShopNotification(
  accessToken: string,
  shopId: number,
  params?: {
    /** 前ページの cursor（notification_id）。未指定で最新から */
    cursor?: number | string;
    /** 1〜50。省略時は 10 */
    page_size?: number;
  },
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/shop/get_shop_notification";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const pageSize =
    params?.page_size == null
      ? 10
      : Math.min(50, Math.max(1, Math.floor(params.page_size)));

  let url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}` +
    `&page_size=${pageSize}`;

  if (params?.cursor != null && String(params.cursor).length > 0) {
    url += `&cursor=${encodeURIComponent(String(params.cursor))}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await parseShopeeResponseJson(response, "get_shop_notification");

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

const ITEM_BASE_INFO_MAX_IDS = 50;

/**
 * 商品マスタ（チャットの item_id から商品名・メイン画像を補完する）
 *
 * 公式は **GET**（クエリに `item_id_list`）。POST は環境によって 404 / 非対応になることがある。
 * @see https://open.shopee.com/documents/v2/v2.product.get_item_base_info?module=89&type=1
 */
export async function getItemBaseInfo(
  accessToken: string,
  shopId: number,
  itemIdList: number[],
  options?: ShopeeApiOptions
): Promise<Record<string, unknown>> {
  const path = "/api/v2/product/get_item_base_info";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const ids = itemIdList
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, ITEM_BASE_INFO_MAX_IDS);

  if (ids.length === 0) {
    return { response: { item_list: [] } };
  }

  /** GET の `item_id_list` は JSON 配列文字列ではなく **カンマ区切り**（`order_sn_list` と同様）。`[123]` だと strconv.ParseUint が失敗する */
  const itemIdListParam = encodeURIComponent(ids.join(","));

  const url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}` +
    `&item_id_list=${itemIdListParam}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await parseShopeeResponseJson(response, "get_item_base_info");

  if (data.error) {
    throw new Error(`Shopee API Error: ${String(data.message ?? data.error)}`);
  }

  return data;
}

/**
 * Get seller chat conversations list
 *
 * Shopee requires `direction` (latest | older) and `type` (pinned | all | unread).
 * See Shopee OpenAPI support: both are mandatory on get_conversation_list.
 */
export async function getConversations(
  accessToken: string,
  shopId: number,
  params?: {
    /** String or cursor object from previous `page_result.next_cursor` */
    next_cursor?: string | Record<string, unknown>;
    page_size?: number;
    /** Pagination: latest = newest first page; older = next page when using next_cursor */
    direction?: "latest" | "older";
    /** Conversation filter: pinned | all | unread */
    listType?: "pinned" | "all" | "unread";
  },
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/sellerchat/get_conversation_list";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const direction: "latest" | "older" =
    params?.direction ?? (params?.next_cursor ? "older" : "latest");
  const listType: "pinned" | "all" | "unread" = params?.listType ?? "all";

  let url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${accessToken}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}` +
    `&direction=${encodeURIComponent(direction)}` +
    `&type=${encodeURIComponent(listType)}`;

  if (params) {
    if (params.next_cursor) {
      const cursor =
        typeof params.next_cursor === "string"
          ? params.next_cursor
          : JSON.stringify(params.next_cursor);
      url += `&next_cursor=${encodeURIComponent(cursor)}`;
    }
    if (params.page_size) {
      url += `&page_size=${params.page_size}`;
    }
  }

  console.log(`[Shopee API] Fetching conversations`);
  console.log(`[Shopee API] URL: ${url.replace(accessToken, 'TOKEN_HIDDEN')}`);
  console.log(`[Shopee API] Shop ID: ${shopId}`);
  console.log(`[Shopee API] Timestamp: ${timestamp}`);

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();
  
  console.log(`[Shopee API] Response status: ${response.status}`);
  console.log(`[Shopee API] Response data:`, JSON.stringify(data, null, 2));

  if (data.error) {
    console.error(`[Shopee API] Error details:`, {
      error: data.error,
      message: data.message,
      request_id: data.request_id,
    });
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * 単一会話の詳細（バイヤーアバター等。一覧に無いフィールドの補完用）
 */
export async function getOneConversation(
  accessToken: string,
  shopId: number,
  conversationId: string,
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/sellerchat/get_one_conversation";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${accessToken}&` +
    `shop_id=${shopId}&` +
    `conversation_id=${encodeURIComponent(String(conversationId))}&` +
    `sign=${sign}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Get messages for a specific conversation
 */
export async function getConversationMessages(
  accessToken: string,
  shopId: number,
  conversationId: string,
  params?: {
    page_size?: number;
    /** 会話一覧と同様: latest 初回 / older で過去ページ */
    direction?: "latest" | "older";
    /** 直前レスポンスの page_result.next_cursor */
    next_cursor?: string | Record<string, unknown>;
    /** オフセット（cursor が無い環境向け。API が無視する場合あり） */
    offset?: number;
  },
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/sellerchat/get_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  let url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${accessToken}&` +
    `shop_id=${shopId}&` +
    `conversation_id=${encodeURIComponent(String(conversationId))}&` +
    `sign=${sign}`;

  if (params?.page_size) {
    url += `&page_size=${params.page_size}`;
  }
  if (params?.direction) {
    url += `&direction=${encodeURIComponent(params.direction)}`;
  }
  if (params?.next_cursor) {
    const cursor =
      typeof params.next_cursor === "string"
        ? params.next_cursor
        : JSON.stringify(params.next_cursor);
    url += `&next_cursor=${encodeURIComponent(cursor)}`;
  }
  if (params?.offset !== undefined) {
    url += `&offset=${params.offset}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

const MESSAGE_FETCH_PAGE_SIZE = 100;
const MESSAGE_FETCH_MAX_PAGES = 40;

/**
 * 会話のメッセージをページネーションで可能な限りすべて取得し、message_id で重複除去する。
 * Shopee は cursor または offset のどちらか（または両方未対応で 1 ページのみ）の可能性があるため、
 * 初回レスポンスに page_result があれば cursor 連鎖、なければ offset 連鎖に切り替える。
 */
export async function fetchAllConversationMessages(
  accessToken: string,
  shopId: number,
  conversationId: string,
  options?: ShopeeApiOptions
): Promise<Record<string, unknown>[]> {
  const seen = new Set<string>();
  const all: Record<string, unknown>[] = [];

  function extractMessages(data: Record<string, unknown>): Record<string, unknown>[] {
    const r = data.response as Record<string, unknown> | undefined;
    return (r?.messages ?? r?.message_list ?? []) as Record<string, unknown>[];
  }

  function pushUnique(batch: Record<string, unknown>[]) {
    for (const msg of batch) {
      const id = String(msg.message_id ?? msg.id ?? "");
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      all.push(msg);
    }
  }

  const first = (await getConversationMessages(
    accessToken,
    shopId,
    conversationId,
    {
      page_size: MESSAGE_FETCH_PAGE_SIZE,
      direction: "latest",
    },
    options
  )) as Record<string, unknown>;

  const firstBatch = extractMessages(first);
  pushUnique(firstBatch);

  const pageResult = (first.response as Record<string, unknown> | undefined)
    ?.page_result as
    | { more?: boolean; next_cursor?: string | Record<string, unknown> }
    | undefined;

  const useCursor =
    pageResult?.more === true ||
    (pageResult?.next_cursor != null && pageResult.next_cursor !== "");

  if (useCursor && pageResult?.next_cursor) {
    let nextCursor: string | Record<string, unknown> | undefined =
      pageResult.next_cursor;
    for (let p = 0; p < MESSAGE_FETCH_MAX_PAGES; p++) {
      const data = (await getConversationMessages(
        accessToken,
        shopId,
        conversationId,
        {
          page_size: MESSAGE_FETCH_PAGE_SIZE,
          direction: "older",
          next_cursor: nextCursor,
        },
        options
      )) as Record<string, unknown>;
      const batch = extractMessages(data);
      const before = seen.size;
      pushUnique(batch);
      if (seen.size === before && batch.length > 0) break;

      const pr = (data.response as Record<string, unknown>)?.page_result as
        | { more?: boolean; next_cursor?: string | Record<string, unknown> }
        | undefined;
      if (pr?.more && pr?.next_cursor) {
        nextCursor = pr.next_cursor;
        continue;
      }
      break;
    }
  } else {
    let offset = firstBatch.length;
    for (let p = 0; p < MESSAGE_FETCH_MAX_PAGES; p++) {
      const data = (await getConversationMessages(
        accessToken,
        shopId,
        conversationId,
        {
          page_size: MESSAGE_FETCH_PAGE_SIZE,
          offset,
        },
        options
      )) as Record<string, unknown>;
      const batch = extractMessages(data);
      if (batch.length === 0) break;
      const before = seen.size;
      pushUnique(batch);
      if (seen.size === before) break;
      offset += batch.length;
      if (batch.length < MESSAGE_FETCH_PAGE_SIZE) break;
    }
  }

  return all;
}

/**
 * Send message to customer
 *
 * Shopee v2.sellerchat.send_message は conversation_id ではなく to_id + message_type + content を要求する。
 * @see https://open.shopee.com/documents/v2/v2.sellerchat.send_message
 */
export async function sendMessage(
  accessToken: string,
  shopId: number,
  toId: number,
  message: string,
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/sellerchat/send_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to_id: toId,
      message_type: "text",
      content: { text: message },
    }),
  });

  const data = await parseShopeeResponseJson(response, "send_message");

  if (data.error) {
    throw new Error(
      `Shopee API Error: ${String(data.message ?? data.error)}`
    );
  }

  return data;
}

/**
 * スタンプ送信（v2.sellerchat.send_message / message_type: sticker）
 */
export async function sendStickerMessage(
  accessToken: string,
  shopId: number,
  toId: number,
  stickerPackageId: string,
  stickerId: string,
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/sellerchat/send_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to_id: toId,
      message_type: "sticker",
      content: {
        sticker_package_id: stickerPackageId,
        sticker_id: stickerId,
      },
    }),
  });

  const data = await parseShopeeResponseJson(response, "send_sticker_message");

  if (data.error) {
    throw new Error(
      `Shopee API Error: ${String(data.message ?? data.error)}`
    );
  }

  return data;
}

/** Shopee `get_order_list`: `time_to - time_from` must be ≤ 15 days (API returns error otherwise). */
export const SHOPEE_ORDER_LIST_MAX_RANGE_SEC = 15 * 24 * 60 * 60;

/**
 * Order list (for matching buyer → order_sn)
 *
 * Shopee 公式は POST でも可だが、同一 host でも GET のみルーティングされる環境があり POST が 404 HTML になる。
 * `get_shop_notification` と同様に GET（クエリにフィルタ）で呼ぶ。
 */
export async function getOrderList(
  accessToken: string,
  shopId: number,
  params: {
    time_range_field: "create_time" | "update_time";
    time_from: number;
    time_to: number;
    page_size: number;
    cursor?: string;
  },
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/order/get_order_list";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  let url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}` +
    `&time_range_field=${encodeURIComponent(params.time_range_field)}` +
    `&time_from=${params.time_from}` +
    `&time_to=${params.time_to}` +
    `&page_size=${params.page_size}`;

  if (params.cursor) {
    url += `&cursor=${encodeURIComponent(params.cursor)}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await parseShopeeResponseJson(response, "get_order_list");

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Order detail by order_sn (max 50 per request)
 *
 * GET クエリでは `order_sn_list` は **カンマ区切り**（例: `SN1,SN2`）。JSON 配列文字列は
 * `error_param` / wrong parameters になり得る。POST の JSON ボディとは形式が異なる点に注意。
 */
export async function getOrderDetail(
  accessToken: string,
  shopId: number,
  orderSnList: string[],
  responseOptionalFields?: string[],
  options?: ShopeeApiOptions
) {
  const path = "/api/v2/order/get_order_detail";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);
  const base = getShopeeBaseUrl(options?.country);

  const sns = orderSnList.slice(0, 50);
  const orderSnQuery = sns.join(",");
  let url =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}` +
    `&order_sn_list=${encodeURIComponent(orderSnQuery)}`;

  if (responseOptionalFields?.length) {
    url += `&response_optional_fields=${encodeURIComponent(
      responseOptionalFields.join(",")
    )}`;
  }

  console.log("getOrderDetail url", url);

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await parseShopeeResponseJson(response, "get_order_detail");

  if (data.error) {
    /** チャット由来の誤検出・他店舗の注文番号などでよくある。呼び出し側は空リスト扱いでよい */
    if (String(data.error) === "error_not_found") {
      return { response: { order_list: [] } } as Record<string, unknown>;
    }
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Generate Shop Authorization URL for OAuth flow
 */
export function generateShopAuthUrl(
  redirectUrl: string,
  options?: ShopeeApiOptions
): string {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const base = getShopeeBaseUrl(options?.country);

  const baseString = `${PARTNER_ID}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(baseString)
    .digest("hex");

  const authUrl =
    `${base}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `sign=${sign}&` +
    `redirect=${encodeURIComponent(redirectUrl)}`;

  return authUrl;
}

import crypto from "crypto";

const PARTNER_ID = parseInt(process.env.SHOPEE_PARTNER_ID || "0");
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const BASE_URL = "https://partner.shopeemobile.com";

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
export async function getAccessToken(code: string, shopId: number) {
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp);

  const url = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

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
export async function refreshAccessToken(refreshToken: string, shopId: number) {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp);

  const url = `${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

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
export async function getShopInfo(accessToken: string, shopId: number) {
  const path = "/api/v2/shop/get_shop_info";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}?` +
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
  }
) {
  const path = "/api/v2/sellerchat/get_conversation_list";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  const direction: "latest" | "older" =
    params?.direction ?? (params?.next_cursor ? "older" : "latest");
  const listType: "pinned" | "all" | "unread" = params?.listType ?? "all";

  let url =
    `${BASE_URL}${path}?` +
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
  conversationId: string
) {
  const path = "/api/v2/sellerchat/get_one_conversation";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}?` +
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
  }
) {
  const path = "/api/v2/sellerchat/get_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  let url =
    `${BASE_URL}${path}?` +
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
  conversationId: string
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
    }
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
        }
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
        }
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
 */
export async function sendMessage(
  accessToken: string,
  shopId: number,
  conversationId: string,
  message: string
) {
  const path = "/api/v2/sellerchat/send_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${accessToken}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Order list (for matching buyer → order_sn)
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
  }
) {
  const path = "/api/v2/order/get_order_list";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      time_range_field: params.time_range_field,
      time_from: params.time_from,
      time_to: params.time_to,
      page_size: params.page_size,
      ...(params.cursor ? { cursor: params.cursor } : {}),
    }),
  });

  const data = await parseShopeeResponseJson(response, "get_order_list");

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Order detail by order_sn (max 50 per request)
 */
export async function getOrderDetail(
  accessToken: string,
  shopId: number,
  orderSnList: string[],
  responseOptionalFields?: string[]
) {
  const path = "/api/v2/order/get_order_detail";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `shop_id=${shopId}&` +
    `sign=${sign}`;

  const body: Record<string, unknown> = {
    order_sn_list: orderSnList.slice(0, 50),
  };
  if (responseOptionalFields?.length) {
    body.response_optional_fields = responseOptionalFields;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await parseShopeeResponseJson(response, "get_order_detail");

  if (data.error) {
    throw new Error(`Shopee API Error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Generate Shop Authorization URL for OAuth flow
 */
export function generateShopAuthUrl(redirectUrl: string): string {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);

  const baseString = `${PARTNER_ID}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(baseString)
    .digest("hex");

  const authUrl =
    `${BASE_URL}${path}?` +
    `partner_id=${PARTNER_ID}&` +
    `timestamp=${timestamp}&` +
    `sign=${sign}&` +
    `redirect=${encodeURIComponent(redirectUrl)}`;

  return authUrl;
}

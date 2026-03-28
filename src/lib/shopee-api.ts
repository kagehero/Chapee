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
 * Get messages for a specific conversation
 */
export async function getConversationMessages(
  accessToken: string,
  shopId: number,
  conversationId: string,
  params?: {
    page_size?: number;
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

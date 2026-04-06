/**
 * Shopee Seller Centre の注文画面へのリンク（国ごとのドメイン）
 *
 * パスに order_sn を埋め込む形式（/portal/sale/order/{sn}）は SPA 側に該当ルートがなく
 * 404 になることが多いため、**クエリ `order_sn`** で開く形式にする。
 * 未ログイン時はログイン後に注文一覧へ遷移する動きになる場合があります。
 *
 * @see https://seller.shopee.sg/ 等
 */
const COUNTRY_TO_SELLER_HOST: Record<string, string> = {
  SG: "seller.shopee.sg",
  MY: "seller.shopee.my",
  PH: "seller.shopee.ph",
  TW: "seller.shopee.tw",
  TH: "seller.shopee.co.th",
  ID: "seller.shopee.co.id",
  VN: "seller.shopee.vn",
  BR: "seller.shopee.com.br",
};

/** バイヤー向け商品ページ（チャット内商品カード用） */
const COUNTRY_TO_BUYER_HOST: Record<string, string> = {
  SG: "shopee.sg",
  MY: "shopee.my",
  PH: "shopee.ph",
  TW: "shopee.tw",
  TH: "shopee.co.th",
  ID: "shopee.co.id",
  VN: "shopee.vn",
  BR: "shopee.com.br",
};

export function buildBuyerItemUrl(country: string, shopId: string, itemId: string): string {
  const c = country.toUpperCase();
  const host = COUNTRY_TO_BUYER_HOST[c] ?? COUNTRY_TO_BUYER_HOST.SG;
  return `https://${host}/product/${shopId}/${itemId}`;
}

/** 注文一覧で order_sn を指定（地域の Seller 画面に合わせたクエリ） */
export function buildSellerOrderUrl(country: string, orderSn: string): string {
  const c = country.toUpperCase();
  const host = COUNTRY_TO_SELLER_HOST[c] ?? COUNTRY_TO_SELLER_HOST.SG;
  const sn = encodeURIComponent(orderSn.trim());
  return `https://${host}/portal/sale/order?order_sn=${sn}`;
}

/** メッセージ JSON 内の order_sn やテキストから推測 */
export function collectOrderSnCandidates(
  rawMessages: Record<string, unknown>[],
  textContents: string[]
): Set<string> {
  const found = new Set<string>();

  const walk = (obj: unknown): void => {
    if (obj == null) return;
    if (typeof obj === "string") return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const kl = k.toLowerCase();
        if (
          (kl === "order_sn" || kl === "ordersn") &&
          typeof v === "string" &&
          v.length >= 8
        ) {
          found.add(v.trim());
        }
        walk(v);
      }
    }
  };

  rawMessages.forEach((msg) => walk(msg));

  for (const text of textContents) {
    const m = text.match(
      /(?:order[_\s]?no|注文|订单|order)[.:\s]*#?\s*([A-Z0-9]{10,})/gi
    );
    if (m) {
      for (const line of m) {
        const inner = line.match(/([A-Z0-9]{10,})/);
        if (inner) found.add(inner[1]);
      }
    }
  }

  return found;
}

/**
 * `get_order_detail` の `item_list[]` からサムネイル URL を取る（フィールド名は API で揺れる）
 */
export function pickOrderItemImageUrl(
  item: Record<string, unknown>
): string | undefined {
  const http = (v: unknown): string | undefined =>
    typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : undefined;

  const direct =
    http(item.image_url) ??
    http(item.item_image) ??
    http(item.item_image_url) ??
    http(item.thumbnail_url) ??
    http(item.model_image);
  if (direct) return direct;

  const ii = item.image_info;
  if (ii && typeof ii === "object") {
    const o = ii as Record<string, unknown>;
    const fromNested =
      http(o.image_url) ?? http(o.thumbnail_url) ?? http(o.url);
    if (fromNested) return fromNested;
    const list = o.image_url_list;
    if (Array.isArray(list)) {
      for (const u of list) {
        const s = http(u);
        if (s) return s;
      }
    }
  }

  return undefined;
}

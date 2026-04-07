/**
 * Shopee OAuth がルート URL（例: https://example.com/）に戻す場合、
 * `redirect("/dashboard")` だけだと `code` / `shop_id` が落ちるため、
 * サーバー側でクエリを維持する。
 */
export function shopeeOAuthReturnQuery(
  sp: Record<string, string | string[] | undefined>
): string {
  const code = typeof sp.code === "string" ? sp.code : undefined;
  const shopId = typeof sp.shop_id === "string" ? sp.shop_id : undefined;
  if (!code || !shopId) return "";
  const q = new URLSearchParams();
  q.set("code", code);
  q.set("shop_id", shopId);
  const country = typeof sp.country === "string" ? sp.country : undefined;
  const region = typeof sp.region === "string" ? sp.region : undefined;
  if (country) q.set("country", country);
  else if (region) q.set("region", region);
  return `?${q.toString()}`;
}

/**
 * Shopee OAuth リダイレクトは `country` の代わりに `region` を付けることが多い。
 * どちらも無い場合のみ従来どおり SG をフォールバックする。
 */
export function countryFromShopeeOAuthSearchParams(sp: URLSearchParams): string {
  const raw =
    sp.get("country")?.trim() || sp.get("region")?.trim() || "";
  const u = raw.toUpperCase();
  return u || "SG";
}

export function countryFromShopeeOAuthRecord(
  sp: Record<string, string | string[] | undefined>
): string {
  const g = (k: string): string | undefined => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  };
  const raw = g("country")?.trim() || g("region")?.trim() || "";
  const u = raw.toUpperCase();
  return u || "SG";
}

export function countryFromShopeeOAuthBody(body: {
  country?: string;
  region?: string;
}): string {
  const c = typeof body.country === "string" ? body.country.trim() : "";
  const r = typeof body.region === "string" ? body.region.trim() : "";
  const raw = c || r;
  return raw.toUpperCase() || "SG";
}

/** get_shop_info の JSON（ネストのばらつきを吸収）から region を取る */
export function regionFromShopInfoPayload(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const tryRegion = (o: Record<string, unknown>): string | undefined => {
    const r = o.region;
    if (typeof r === "string" && r.trim()) return r.trim().toUpperCase();
    const shop = o.shop;
    if (shop && typeof shop === "object" && !Array.isArray(shop)) {
      const sr = (shop as Record<string, unknown>).region;
      if (typeof sr === "string" && sr.trim()) return sr.trim().toUpperCase();
    }
    return undefined;
  };
  const fromResp = d.response;
  if (fromResp && typeof fromResp === "object" && !Array.isArray(fromResp)) {
    const got = tryRegion(fromResp as Record<string, unknown>);
    if (got) return got;
  }
  return tryRegion(d);
}

/** get_shop_info の JSON から店舗名を取る */
export function shopNameFromShopInfoPayload(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const tryName = (o: Record<string, unknown>): string | undefined => {
    const n = o.shop_name;
    if (typeof n === "string" && n.trim()) return n.trim();
    const shop = o.shop;
    if (shop && typeof shop === "object" && !Array.isArray(shop)) {
      const sn = (shop as Record<string, unknown>).shop_name;
      if (typeof sn === "string" && sn.trim()) return sn.trim();
    }
    return undefined;
  };
  const fromResp = d.response;
  if (fromResp && typeof fromResp === "object" && !Array.isArray(fromResp)) {
    const got = tryName(fromResp as Record<string, unknown>);
    if (got) return got;
  }
  return tryName(d);
}

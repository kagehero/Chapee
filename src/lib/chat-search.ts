/** 検索用に文字列を正規化（トリム・小文字・連続スペースを1つに） */
export function normalizeForSearch(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type ChatSearchableFields = {
  customer?: string;
  product?: string;
  lastMessage?: string;
  itemId?: string;
  country?: string;
  id?: string;
  customer_id?: number;
};

/**
 * 検索クエリがチャット行にヒットするか（スペース区切り AND・部分一致）
 */
export function matchChatSearchQuery(
  query: string,
  chat: ChatSearchableFields
): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const tokens = q.split(" ").filter(Boolean);
  const searchable = normalizeForSearch(
    [
      chat.customer ?? "",
      chat.product ?? "",
      chat.lastMessage ?? "",
      chat.itemId ?? "",
      chat.country ?? "",
      chat.id ?? "",
      chat.customer_id != null ? String(chat.customer_id) : "",
    ].join(" ")
  );
  const searchableNoSpaces = searchable.replace(/\s/g, "");
  return tokens.every((token) =>
    searchableNoSpaces.includes(
      normalizeForSearch(token).replace(/\s/g, "")
    )
  );
}

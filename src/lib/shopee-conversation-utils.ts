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

const NOTIFICATION_LIKE_TYPES = new Set([
  "return_refund_card",
  "out_of_stock_reminder_card",
  "faq_liveagent_prompt",
  "order_notification",
  "system",
]);

export function inferChatTypeFromShopee(conv: {
  latest_message_type?: string;
  to_name?: string;
}): UiChatType {
  const name = (conv.to_name || "").toLowerCase();
  const mt = (conv.latest_message_type || "").toLowerCase();
  if (name.includes("shopee") && name.includes("通知")) return "notification";
  if (NOTIFICATION_LIKE_TYPES.has(mt)) return "notification";
  if (mt.includes("affiliate")) return "affiliate";
  return "buyer";
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

/** Normalize a single chat message payload from Shopee `get_message` into display text */
export function textFromShopeeChatMessage(msg: Record<string, unknown>): string {
  const m = msg.message;
  if (typeof m === "string" && m.trim()) return m;
  if (m && typeof m === "object" && "text" in m && typeof (m as { text?: string }).text === "string") {
    return (m as { text: string }).text;
  }
  const content = msg.content;
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "text" in (content as object)) {
    const t = (content as { text?: string }).text;
    if (typeof t === "string") return t;
  }
  const mt = msg.message_type ?? msg.type;
  return typeof mt === "string" || typeof mt === "number" ? `[${mt}]` : "";
}

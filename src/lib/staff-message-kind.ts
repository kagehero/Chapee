import { getCollection } from "@/lib/mongodb";

export type StaffMessageKindTag = "manual" | "template" | "auto";

const LOG_KEY = "staff_message_kind_log" as const;
const MAX_LOG = 120;

export type StaffMessageKindEntry = {
  id: string;
  kind: StaffMessageKindTag;
};

/** Shopee `send_message` 応答から message_id を取り出す */
export function extractMessageIdFromSendResponse(
  data: Record<string, unknown>
): string | null {
  const resp = data.response as Record<string, unknown> | undefined;
  const raw =
    resp?.message_id ??
    data.message_id ??
    (resp?.data as Record<string, unknown> | undefined)?.message_id;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length ? s : null;
}

/**
 * 手動送信・テンプレ送信・自動返信で付与した message_id を記録（再読込後もバッジ用）
 */
export async function recordStaffMessageKind(
  conversationId: string,
  shopId: number,
  messageId: string,
  kind: StaffMessageKindTag
): Promise<void> {
  const id = messageId.trim();
  if (!id) return;

  const col = await getCollection<{
    conversation_id: string;
    shop_id: number;
    staff_message_kind_log?: StaffMessageKindEntry[];
  }>("shopee_conversations");

  await col.updateOne(
    { conversation_id: String(conversationId), shop_id: shopId },
    {
      $push: {
        [LOG_KEY]: {
          $each: [{ id, kind }],
          $slice: -MAX_LOG,
        },
      },
      $set: { updated_at: new Date() },
    }
  );
}

const VALID_KINDS = new Set<StaffMessageKindTag>(["manual", "template", "auto"]);

/** ログ末尾＝直近の店舗送信の種別（一覧表示用） */
export function lastStaffKindFromLog(
  log: Array<{ kind?: string }> | undefined
): StaffMessageKindTag | undefined {
  if (!log?.length) return undefined;
  const last = log[log.length - 1];
  const k = last?.kind as StaffMessageKindTag | undefined;
  return k && VALID_KINDS.has(k) ? k : undefined;
}

/** ログから message_id → 最後に記録された kind（上書き優先） */
export function kindMapFromLog(
  log: Array<{ id?: string; kind?: string }> | undefined
): Map<string, StaffMessageKindTag> {
  const m = new Map<string, StaffMessageKindTag>();
  if (!log?.length) return m;
  for (const row of log) {
    const k = row?.kind as StaffMessageKindTag;
    if (row?.id && k && VALID_KINDS.has(k)) m.set(String(row.id), k);
  }
  return m;
}

import { getCollection } from "@/lib/mongodb";
import type { StaffMessageKindTag } from "./staff-message-kind-log";

export type { StaffMessageKindTag } from "./staff-message-kind-log";
export { lastStaffKindFromLog, kindMapFromLog } from "./staff-message-kind-log";

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

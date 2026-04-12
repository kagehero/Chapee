import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { sendMessage } from "@/lib/shopee-api";
import { getShopCountry, getValidToken } from "@/lib/shopee-token";
import {
  extractMessageIdFromSendResponse,
  recordStaffMessageKind,
} from "@/lib/staff-message-kind";
import { shopeeMessageTimeToMs } from "@/lib/shopee-conversation-utils";

/** Mirrors `AutoReplyCountryStored` in settings API */
type AutoReplyCountryCfg = {
  enabled: boolean;
  triggerHour: number;
  template_id: string;
  subAccounts?: { id: string; name: string; enabled: boolean }[];
};

async function getSingletonAutoReplyCountries(): Promise<
  Record<string, AutoReplyCountryCfg>
> {
  const col = await getCollection<{
    _id: string;
    countries: Record<string, AutoReplyCountryCfg>;
  }>("auto_reply_settings");
  const doc = await col.findOne({ _id: "singleton" });
  return doc?.countries ?? {};
}

async function resolveTemplateContent(templateId: string): Promise<string | null> {
  if (!templateId || !ObjectId.isValid(templateId)) return null;
  const col = await getCollection<{ _id: ObjectId; content: string }>(
    "reply_templates"
  );
  const doc = await col.findOne({ _id: new ObjectId(templateId) });
  const text = doc?.content?.trim();
  return text || null;
}

/**
 * /api/shopee/sync のフォールバック用。
 * 生メッセージが取得できない状況で、unread_count > 0 の会話に対して
 * last_message_time + triggerHour を due_at としてセットする。
 * - 既に auto_reply_pending=true かつ due_at が設定済みの場合はスキップ（上書きしない）。
 * - last_auto_reply_at がバイヤー最終メッセージより後の場合もスキップ。
 */
export async function scheduleAutoReplyForUnread(
  shopId: number,
  conversationIds: string[]
): Promise<void> {
  if (!conversationIds.length) return;

  const country = (await getShopCountry(shopId)) ?? "SG";
  const countryKey = String(country).toUpperCase();
  const countries = await getSingletonAutoReplyCountries();
  const cfg = countries[countryKey];

  if (!cfg?.enabled || !cfg.template_id?.trim() || !ObjectId.isValid(cfg.template_id.trim())) {
    return;
  }

  const triggerHour = Math.max(1, Number(cfg.triggerHour) || 1);
  const triggerMs = triggerHour * 60 * 60 * 1000;

  const col = await getCollection<{
    conversation_id: string;
    shop_id: number;
    chat_type?: string;
    last_message_time?: Date;
    auto_reply_pending?: boolean;
    auto_reply_due_at?: Date | null;
    last_auto_reply_at?: Date | null;
  }>("shopee_conversations");

  const docs = await col
    .find({
      conversation_id: { $in: conversationIds },
      shop_id: shopId,
    })
    .toArray();

  const now = Date.now();
  for (const doc of docs) {
    if (doc.chat_type === "notification") continue;
    // 既にスケジュール済みならスキップ
    if (doc.auto_reply_pending && doc.auto_reply_due_at) continue;

    const lastMsgMs = doc.last_message_time instanceof Date
      ? doc.last_message_time.getTime()
      : 0;
    if (lastMsgMs === 0) continue;

    // 自動返信済みならスキップ
    const lastAutoAt = doc.last_auto_reply_at;
    if (lastAutoAt instanceof Date && lastAutoAt.getTime() >= lastMsgMs) continue;

    const dueMs = lastMsgMs + triggerMs;
    const due = new Date(dueMs > now ? dueMs : now);

    await col.updateOne(
      { conversation_id: doc.conversation_id, shop_id: shopId },
      { $set: { auto_reply_pending: true, auto_reply_due_at: due, updated_at: new Date() } }
    );
    console.log(
      `[auto-reply] sync-fallback: scheduled conv=${doc.conversation_id} shop=${shopId} due=${due.toISOString()}`
    );
  }
}

/** スタッフ送信後・手動送信後に保留中の自動返信をキャンセル */
export async function clearAutoReplySchedule(
  conversationId: string,
  shopId: number
): Promise<void> {
  const col = await getCollection("shopee_conversations");
  await col.updateOne(
    { conversation_id: String(conversationId), shop_id: shopId },
    {
      $set: {
        auto_reply_pending: false,
        auto_reply_due_at: null,
        updated_at: new Date(),
      },
    }
  );
}

/**
 * Review and correct the auto-reply schedule based on **actual message timestamps**.
 *
 * Called whenever the full raw message list is available:
 *   - Inside syncWebhookConversationFull (covers missed/delayed webhooks)
 *   - Inside GET /api/chats/[id]/messages (covers manual page refreshes)
 *
 * Outcomes:
 *   - Staff replied after last buyer message  → cancel any pending schedule.
 *   - Buyer message unanswered               → (re-)schedule due_at = lastBuyerTime + triggerHour.
 *   - Already overdue                         → due_at = now (fires on next cron tick).
 *   - Auto-reply already sent after that msg  → no-op (won't double-send).
 *   - Auto-reply disabled / no template       → clear pending and return.
 */
export async function reviewAutoReplySchedule(
  rawMessages: Record<string, unknown>[],
  shopId: number,
  conversationId: string,
): Promise<void> {
  const convId = String(conversationId);
  try {
    const col = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country?: string;
      chat_type?: string;
      auto_reply_pending?: boolean;
      auto_reply_due_at?: Date | null;
      last_auto_reply_at?: Date | null;
    }>("shopee_conversations");

    const existing = await col.findOne({ conversation_id: convId, shop_id: shopId });
    if (!existing) return;
    if (existing.chat_type === "notification") return;

    const country = (await getShopCountry(shopId)) ?? existing.country ?? "SG";
    const countryKey = String(country).toUpperCase();
    const countries = await getSingletonAutoReplyCountries();
    const cfg = countries[countryKey];

    if (!cfg?.enabled || !cfg.template_id?.trim() || !ObjectId.isValid(cfg.template_id.trim())) {
      if (existing.auto_reply_pending) {
        await clearAutoReplySchedule(convId, shopId);
      }
      return;
    }

    const triggerHour = Math.max(1, Number(cfg.triggerHour) || 1);

    // Determine last buyer and last staff message timestamps from the raw list
    let lastBuyerMs = 0;
    let lastStaffMs = 0;
    for (const msg of rawMessages) {
      const fromId = Number(msg.from_id ?? msg.from_user_id ?? 0);
      const ts = shopeeMessageTimeToMs(msg.timestamp ?? msg.created_timestamp ?? msg.time);
      if (fromId === shopId) {
        if (ts > lastStaffMs) lastStaffMs = ts;
      } else if (fromId > 0) {
        if (ts > lastBuyerMs) lastBuyerMs = ts;
      }
    }

    if (lastBuyerMs === 0) return; // no identifiable buyer messages

    // Staff has already replied after the last buyer message → cancel
    if (lastStaffMs >= lastBuyerMs) {
      if (existing.auto_reply_pending) {
        await clearAutoReplySchedule(convId, shopId);
        console.log(`[auto-reply] review: cleared (staff replied) conv=${convId}`);
      }
      return;
    }

    // Auto-reply was already sent after this buyer message → no-op
    const lastAutoAt = existing.last_auto_reply_at;
    if (lastAutoAt instanceof Date && lastAutoAt.getTime() >= lastBuyerMs) return;

    // Compute correct due time from the actual buyer message timestamp
    const dueMs = lastBuyerMs + triggerHour * 60 * 60 * 1000;
    const now = Date.now();
    // If already past due, schedule for the next cron tick
    const due = new Date(dueMs > now ? dueMs : now);

    // Skip write if already scheduled with the same due time (±1 min tolerance)
    const existingDue = existing.auto_reply_due_at?.getTime?.();
    if (
      existing.auto_reply_pending === true &&
      typeof existingDue === "number" &&
      Math.abs(existingDue - due.getTime()) < 60_000
    ) {
      return;
    }

    await col.updateOne(
      { conversation_id: convId, shop_id: shopId },
      { $set: { auto_reply_pending: true, auto_reply_due_at: due, updated_at: new Date() } }
    );

    console.log(
      `[auto-reply] review: (re-)scheduled conv=${convId} shop=${shopId} due=${due.toISOString()} (${triggerHour}h from last buyer msg)`
    );
  } catch (e) {
    console.warn(`[auto-reply] reviewAutoReplySchedule failed conv=${convId}:`, e);
  }
}

type WebhookMsg = {
  shop_id: number;
  conversation_id: string;
  to_id: number;
  to_name: string;
  from_id: number;
  /** DB sync returns a Date; webhook data may supply a raw ms number. */
  last_buyer_message_time?: Date | number;
};

/**
 * Webhook: バイヤーからのメッセージで自動返信を予約、店舗からならキャンセル。
 */
export async function handleAutoReplyOnWebhookMessage(
  data: WebhookMsg
): Promise<void> {
  const { shop_id, conversation_id, to_id, to_name, from_id } = data;
  const convId = String(conversation_id);
  const isStaff = Number(from_id) === Number(shop_id);

  const col = await getCollection<{
    conversation_id: string;
    shop_id: number;
    country?: string;
    customer_id?: number;
    chat_type?: string;
    customer_name?: string;
  }>("shopee_conversations");

  if (isStaff) {
    await clearAutoReplySchedule(convId, shop_id);
    return;
  }

  const existingCountry = (await col.findOne({ conversation_id: convId, shop_id }))
    ?.country;
  const country =
    (await getShopCountry(shop_id)) ?? existingCountry ?? "SG";
  const countryKey = String(country).toUpperCase();

  const existing = await col.findOne({ conversation_id: convId, shop_id });
  if (existing?.chat_type === "notification") return;

  const countries = await getSingletonAutoReplyCountries();
  const cfg = countries[countryKey];
  if (!cfg?.enabled || !cfg.template_id?.trim()) return;
  if (!ObjectId.isValid(cfg.template_id.trim())) return;

  const triggerHour = Math.max(1, Number(cfg.triggerHour) || 1);
  const due = new Date(Date.now() + triggerHour * 60 * 60 * 1000);

  await col.updateOne(
    { conversation_id: convId, shop_id },
    {
      $set: {
        auto_reply_pending: true,
        auto_reply_due_at: due,
        updated_at: new Date(),
      },
    }
  );

  console.log(
    `[auto-reply] Scheduled for ${convId} shop=${shop_id} due=${due.toISOString()} (${triggerHour}h)`
  );
}

export type ProcessAutoReplyResult = {
  processed: number;
  sent: number;
  skipped: number;
  errors: { conversation_id: string; error: string }[];
};

const MAX_BATCH = 30;

/**
 * 期限到来の会話にテンプレートを送信（cron 用）
 */
export async function processDueAutoReplies(): Promise<ProcessAutoReplyResult> {
  const result: ProcessAutoReplyResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const col = await getCollection<{
    conversation_id: string;
    shop_id: number;
    country?: string;
    customer_id: number;
    auto_reply_pending?: boolean;
    auto_reply_due_at?: Date | null;
    chat_type?: string;
  }>("shopee_conversations");

  const now = new Date();
  const countries = await getSingletonAutoReplyCountries();

  const due = await col
    .find({
      auto_reply_pending: true,
      auto_reply_due_at: { $lte: now },
    })
    .limit(MAX_BATCH)
    .toArray();

  for (const doc of due) {
    result.processed++;
    const convId = String(doc.conversation_id);
    const shopId = doc.shop_id;

    const claimed = await col.findOneAndUpdate(
      {
        conversation_id: convId,
        shop_id: shopId,
        auto_reply_pending: true,
        auto_reply_due_at: { $lte: now },
      },
      {
        $set: {
          auto_reply_pending: false,
          auto_reply_due_at: null,
          updated_at: new Date(),
        },
      },
      { returnDocument: "before" }
    );

    if (!claimed) {
      result.skipped++;
      continue;
    }

    try {
      if (doc.chat_type === "notification") {
        result.skipped++;
        continue;
      }

      const countryKey = String(
        doc.country ?? (await getShopCountry(shopId)) ?? "SG"
      ).toUpperCase();
      const cfg = countries[countryKey];
      if (!cfg?.enabled || !cfg.template_id?.trim()) {
        result.skipped++;
        continue;
      }

      const content = await resolveTemplateContent(cfg.template_id);
      if (!content) {
        result.skipped++;
        continue;
      }

      const accessToken = await getValidToken(shopId);
      const buyerId = Number(doc.customer_id);
      if (!Number.isFinite(buyerId) || buyerId <= 0) {
        result.skipped++;
        continue;
      }

      const sendRes = (await sendMessage(
        accessToken,
        shopId,
        buyerId,
        content,
        { country: countryKey }
      )) as Record<string, unknown>;
      const sentId = extractMessageIdFromSendResponse(sendRes);
      if (sentId) {
        await recordStaffMessageKind(convId, shopId, sentId, "auto");
      }

      await col.updateOne(
        { conversation_id: convId, shop_id: shopId },
        {
          $set: {
            last_message: content,
            last_message_time: new Date(),
            unread_count: 0,
            last_auto_reply_at: new Date(),
            handling_status: "auto_replied_pending",
            updated_at: new Date(),
          },
        }
      );

      result.sent++;
      console.log(`[auto-reply] Sent to conversation ${convId} shop=${shopId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push({ conversation_id: convId, error: msg });
      console.error(`[auto-reply] Failed ${convId}:`, e);
      try {
        await col.updateOne(
          { conversation_id: convId, shop_id: shopId },
          {
            $set: {
              auto_reply_pending: false,
              auto_reply_due_at: null,
              updated_at: new Date(),
            },
          }
        );
      } catch {
        /* ignore */
      }
    }
  }

  return result;
}

import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { sendMessage, getOrderList, getOrderDetail } from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";
import {
  extractMessageIdFromSendResponse,
  recordStaffMessageKind,
} from "@/lib/staff-message-kind";

/** Mirrors `AutoReplyCountryStored` in settings API */
type AutoReplyCountryCfg = {
  enabled: boolean;
  triggerHour: number;
  statuses: string[];
  template_id: string;
  subAccounts?: { id: string; name: string; enabled: boolean }[];
};

/** UI の日本語ラベル → Shopee `order_status` 文字列（複数候補） */
const JP_ORDER_STATUS_TO_API: Record<string, readonly string[]> = {
  注文受付: ["UNPAID", "READY_TO_SHIP", "PROCESSED"],
  発送準備中: ["READY_TO_SHIP", "PROCESSED"],
  発送済み: ["SHIPPED"],
  配達中: ["SHIPPED", "TO_CONFIRM_RECEIVE"],
  配達完了: ["COMPLETED"],
  キャンセル: ["CANCELLED", "IN_CANCEL", "IN_CANCELLED"],
};

function allowedApiStatusesFromJp(selected: string[]): Set<string> {
  const s = new Set<string>();
  for (const jp of selected) {
    const codes = JP_ORDER_STATUS_TO_API[jp];
    if (codes) codes.forEach((c) => s.add(c));
  }
  return s;
}

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

export async function getShopCountry(shopId: number): Promise<string | null> {
  const col = await getCollection<{ shop_id: number; country: string }>(
    "shopee_tokens"
  );
  const row = await col.findOne({ shop_id: shopId });
  return row?.country ? String(row.country).toUpperCase() : null;
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
 * 選択された注文ステータスに合致するバイヤー注文が1件でもあれば true。
 * `selectedJp` が空ならフィルタなし（true）。
 */
export async function buyerMatchesOrderStatusFilter(
  accessToken: string,
  shopId: number,
  buyerUserId: number,
  selectedJp: string[]
): Promise<boolean> {
  if (!selectedJp.length) return true;

  const allowed = allowedApiStatusesFromJp(selectedJp);
  if (allowed.size === 0) return true;

  const now = Math.floor(Date.now() / 1000);
  const ninetyDays = 90 * 24 * 60 * 60;
  const listRes = (await getOrderList(accessToken, shopId, {
    time_range_field: "create_time",
    time_from: now - ninetyDays,
    time_to: now,
    page_size: 100,
  })) as Record<string, unknown>;
  const listNested = listRes.response as Record<string, unknown> | undefined;
  const orders = (listNested?.order_list ??
    listRes.order_list ??
    []) as Record<string, unknown>[];

  const sns: string[] = [];
  for (const row of orders) {
    const bid = Number(row.buyer_user_id ?? row.buyer_userid ?? 0);
    if (bid === buyerUserId && row.order_sn) {
      sns.push(String(row.order_sn));
    }
  }
  if (sns.length === 0) return false;

  const detailRes = (await getOrderDetail(
    accessToken,
    shopId,
    sns.slice(0, 50),
    ["order_status"]
  )) as Record<string, unknown>;
  const detailNested = detailRes.response as Record<string, unknown> | undefined;
  const detailList = (detailNested?.order_list ??
    detailRes.order_list ??
    []) as Record<string, unknown>[];

  for (const row of detailList) {
    const st = String(row.order_status ?? "").toUpperCase();
    if (allowed.has(st)) return true;
  }
  return false;
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

type WebhookMsg = {
  shop_id: number;
  conversation_id: string;
  to_id: number;
  to_name: string;
  from_id: number;
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

      const statuses = Array.isArray(cfg.statuses) ? cfg.statuses : [];
      const ok = await buyerMatchesOrderStatusFilter(
        accessToken,
        shopId,
        buyerId,
        statuses
      );
      if (!ok) {
        result.skipped++;
        console.log(
          `[auto-reply] Skip ${convId}: no order matching statuses for buyer ${buyerId}`
        );
        continue;
      }

      const sendRes = (await sendMessage(
        accessToken,
        shopId,
        convId,
        content
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

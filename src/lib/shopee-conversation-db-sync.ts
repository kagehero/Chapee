import type { AnyBulkWriteOperation } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import {
  fetchAllConversationMessages,
  getOneConversation,
} from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";
import {
  displayFromShopeeChatMessage,
  extractBuyerAvatarFromShopee,
  isLatestMessageFromBuyer,
  shopeeMessageTimeToMs,
} from "@/lib/shopee-conversation-utils";
import { reviewAutoReplySchedule } from "@/lib/auto-reply";
import {
  type HandlingStatus,
  resolveHandlingStatus,
} from "@/lib/handling-status";

/** Webhook 同期後のメッセージ行を保持（GET /messages が DB から組み立て可能に） */
export const SHOPEE_CHAT_MESSAGES_COLLECTION = "shopee_chat_messages";

export type ShopeeChatMessageDoc = {
  conversation_id: string;
  shop_id: number;
  message_id: string;
  raw: Record<string, unknown>;
  timestamp_ms: number;
  synced_at: Date;
};

function parseOneConversationBody(oneRes: unknown): Record<string, unknown> | null {
  if (!oneRes || typeof oneRes !== "object") return null;
  const d = oneRes as Record<string, unknown>;
  const r = d.response as Record<string, unknown> | undefined;
  return (r?.conversation ?? r ?? d) as Record<string, unknown>;
}

function pickLatestMessage(
  rawList: Record<string, unknown>[]
): Record<string, unknown> | undefined {
  if (!rawList.length) return undefined;
  let best = rawList[0];
  let bestMs = shopeeMessageTimeToMs(
    best.timestamp ?? best.created_timestamp ?? best.time
  );
  for (let i = 1; i < rawList.length; i++) {
    const m = rawList[i];
    const ms = shopeeMessageTimeToMs(m.timestamp ?? m.created_timestamp ?? m.time);
    if (ms >= bestMs) {
      bestMs = ms;
      best = m;
    }
  }
  return best;
}

/** バイヤー（shopId 以外が送信）のメッセージの中で最新のものを返す */
function pickLatestBuyerMessage(
  rawList: Record<string, unknown>[],
  shopId: number
): Record<string, unknown> | undefined {
  const buyerMsgs = rawList.filter((m) => {
    const fromId = Number(m.from_id ?? m.from_user_id ?? 0);
    return fromId !== shopId;
  });
  return pickLatestMessage(buyerMsgs);
}

/**
 * Webhook（code 10）後: Shopee から全メッセージ + 会話1件を取得し、
 * - `shopee_chat_messages` に upsert
 * - `shopee_conversations` を国・バイヤーID・最新文面・未読など API 正で上書き
 */
export async function syncWebhookConversationFull(
  shopId: number,
  conversationId: string
): Promise<{
  ok: boolean;
  messageCount: number;
  error?: string;
  rawList: Record<string, unknown>[];
  autoReplyHint?: {
    shop_id: number;
    conversation_id: string;
    to_id: number;
    to_name: string;
    from_id: number;
    last_buyer_message_time?: Date;
  };
}> {
  try {
    const tokenCol = await getCollection<{ shop_id: number; country: string }>(
      "shopee_tokens"
    );
    const tokenRow = await tokenCol.findOne({ shop_id: shopId });
    const country = tokenRow?.country
      ? String(tokenRow.country).toUpperCase()
      : undefined;
    const countryOpt = country ? { country } : undefined;

    const accessToken = await getValidToken(shopId);
    const [rawList, oneRes] = await Promise.all([
      fetchAllConversationMessages(accessToken, shopId, conversationId, countryOpt),
      getOneConversation(accessToken, shopId, conversationId, countryOpt),
    ]);

    const convObj = parseOneConversationBody(oneRes);
    const buyerId = Number(convObj?.to_id ?? convObj?.to_user_id ?? 0);
    const buyerName = String(convObj?.to_name ?? "").trim();
    const unreadFromApi = convObj?.unread_count;
    const unreadCount =
      typeof unreadFromApi === "number" && Number.isFinite(unreadFromApi)
        ? Math.max(0, Math.floor(unreadFromApi))
        : undefined;

    const avatar = convObj
      ? extractBuyerAvatarFromShopee(convObj)
      : undefined;

    const msgCol = await getCollection<ShopeeChatMessageDoc>(
      SHOPEE_CHAT_MESSAGES_COLLECTION
    );

    const now = new Date();
    const bulk: AnyBulkWriteOperation<ShopeeChatMessageDoc>[] = [];
    for (const raw of rawList) {
      const mid = String(raw.message_id ?? raw.id ?? "").trim();
      if (!mid) continue;
      const tsMs = shopeeMessageTimeToMs(
        raw.timestamp ?? raw.created_timestamp ?? raw.time
      );
      bulk.push({
        updateOne: {
          filter: {
            conversation_id: String(conversationId),
            shop_id: shopId,
            message_id: mid,
          },
          update: {
            $set: {
              conversation_id: String(conversationId),
              shop_id: shopId,
              message_id: mid,
              raw,
              timestamp_ms: tsMs,
              synced_at: now,
            },
          },
          upsert: true,
        },
      });
    }
    if (bulk.length > 0) {
      await msgCol.bulkWrite(bulk, { ordered: false });
    }

    const latest = pickLatestMessage(rawList);
    const lastPreview = latest
      ? displayFromShopeeChatMessage(latest).summary
      : "";
    const lastTime = latest
      ? new Date(
          shopeeMessageTimeToMs(
            latest.timestamp ?? latest.created_timestamp ?? latest.time
          )
        )
      : new Date();

    const latestBuyer = pickLatestBuyerMessage(rawList, shopId);
    const lastBuyerTime = latestBuyer
      ? new Date(
          shopeeMessageTimeToMs(
            latestBuyer.timestamp ?? latestBuyer.created_timestamp ?? latestBuyer.time
          )
        )
      : undefined;

    const convCol = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country?: string;
      customer_id: number;
      customer_name: string;
      last_message: string;
      last_message_time: Date;
      last_buyer_message_time?: Date;
      unread_count: number;
      status: string;
      customer_avatar_url?: string;
      handling_status?: string;
      staff_message_kind_log?: { id: string; kind: string }[];
    }>("shopee_conversations");

    const existing = await convCol.findOne({
      conversation_id: String(conversationId),
      shop_id: shopId,
    });

    const setConv: Record<string, unknown> = {
      status: "active",
      updated_at: now,
      last_message: lastPreview || "",
      last_message_time: lastTime,
    };
    if (lastBuyerTime) setConv.last_buyer_message_time = lastBuyerTime;
    if (country) setConv.country = country;
    if (Number.isFinite(buyerId) && buyerId > 0) setConv.customer_id = buyerId;
    if (buyerName) setConv.customer_name = buyerName;
    if (unreadCount !== undefined) setConv.unread_count = unreadCount;
    if (avatar) setConv.customer_avatar_url = avatar;

    const buyerUid =
      Number.isFinite(buyerId) && buyerId > 0
        ? buyerId
        : Number(existing?.customer_id ?? 0);
    const buyerLast =
      buyerUid > 0
        ? isLatestMessageFromBuyer(
            rawList as Record<string, unknown>[],
            shopId,
            buyerUid
          )
        : false;

    const resolvedHandling = resolveHandlingStatus(
      {
        handling_status: existing?.handling_status as HandlingStatus | undefined,
        unread_count:
          unreadCount !== undefined
            ? unreadCount
            : Math.max(0, Number(existing?.unread_count ?? 0)),
        staff_message_kind_log: existing?.staff_message_kind_log,
        last_message_time: lastTime,
        last_buyer_message_time: lastBuyerTime,
      },
      { buyer_last_message_is_latest: buyerLast }
    );
    setConv.handling_status = resolvedHandling;

    await convCol.updateOne(
      { conversation_id: String(conversationId), shop_id: shopId },
      {
        $set: setConv,
        $setOnInsert: {
          conversation_id: String(conversationId),
          shop_id: shopId,
          created_at: now,
        },
      },
      { upsert: true }
    );

    // Re-evaluate auto-reply schedule from actual message timestamps.
    // This handles missed or delayed webhooks without relying on the caller.
    await reviewAutoReplySchedule(rawList, shopId, String(conversationId));

    const latestFromId = latest
      ? Number(latest.from_id ?? latest.from_user_id ?? 0)
      : 0;

    return {
      ok: true,
      messageCount: rawList.length,
      rawList,
      autoReplyHint: {
        shop_id: shopId,
        conversation_id: String(conversationId),
        to_id: Number.isFinite(buyerId) && buyerId > 0 ? buyerId : 0,
        to_name: buyerName,
        /** 最新メッセージの送信元（Webhook の data が欠けるときの代替） */
        from_id: Number.isFinite(latestFromId) ? latestFromId : 0,
        last_buyer_message_time: lastBuyerTime,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `[webhook-db-sync] syncWebhookConversationFull failed shop=${shopId} conv=${conversationId}:`,
      msg
    );
    return {
      ok: false,
      messageCount: 0,
      error: msg,
      rawList: [],
      autoReplyHint: undefined,
    };
  }
}

/** GET /messages 用: DB に同期済みの raw 行（時系列） */
export async function getStoredRawMessagesForConversation(
  shopId: number,
  conversationId: string
): Promise<Record<string, unknown>[]> {
  const msgCol = await getCollection<ShopeeChatMessageDoc>(
    SHOPEE_CHAT_MESSAGES_COLLECTION
  );
  const rows = await msgCol
    .find({ conversation_id: String(conversationId), shop_id: shopId })
    .sort({ timestamp_ms: 1 })
    .toArray();
  return rows.map((r) => r.raw);
}

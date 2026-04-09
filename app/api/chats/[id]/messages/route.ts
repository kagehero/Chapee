import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import {
  fetchAllConversationMessages,
  getOneConversation,
  getShopInfo,
} from "@/lib/shopee-api";
import { getValidToken, resolveCountryForShop } from "@/lib/shopee-token";
import {
  displayFromShopeeChatMessage,
  extractBuyerAvatarFromShopee,
  extractShopLogoFromShopInfo,
  extractInquiredItemsFromOneConversation,
  inferChatMessageSender,
  inferStaffMessageAutoHint,
  shopeeMessageTimeToMs,
} from "@/lib/shopee-conversation-utils";
import { buildBuyerItemUrl, buildSellerOrderUrl } from "@/lib/shopee-order-utils";
import { fetchItemCatalogMapByIds, fetchOrderItemInfoMap } from "@/lib/shopee-product-utils";
import { kindMapFromLog } from "@/lib/staff-message-kind";
import { getStoredRawMessagesForConversation } from "@/lib/shopee-conversation-db-sync";
import { reviewAutoReplySchedule } from "@/lib/auto-reply";

/**
 * GET /api/chats/[id]/messages - Get messages for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Shopee API + MongoDB only
    // Get conversation details
    const convCol = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country?: string;
      customer_id: number;
      customer_name: string;
      customer_avatar_url?: string;
      staff_message_kind_log?: { id: string; kind: string }[];
    }>("shopee_conversations");

    const conversation = await convCol.findOne({
      conversation_id: String(conversationId),
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const staffKindByMessageId = kindMapFromLog(
      conversation.staff_message_kind_log
    );

    const accessToken = await getValidToken(conversation.shop_id);
    const countryResolved = await resolveCountryForShop(
      conversation.shop_id,
      conversation.country
    );
    const countryOpt = { country: countryResolved };

    let customerAvatar: string | null =
      conversation.customer_avatar_url ?? null;
    let shopLogo: string | null = null;
    let inquiredItems: {
      item_id?: string;
      shop_id?: string;
      name?: string;
      image_url?: string;
      item_url?: string;
    }[] = [];

    /** Webhook が書いたキャッシュ。API 失敗時のみフォールバックに使う。 */
    const storedRaws = await getStoredRawMessagesForConversation(
      conversation.shop_id,
      conversationId
    );

    const [msgResult, oneRes, shopRes] = await Promise.allSettled([
      (async () => {
        try {
          return await fetchAllConversationMessages(
            accessToken,
            conversation.shop_id,
            conversationId,
            countryOpt
          );
        } catch (err) {
          if (storedRaws.length > 0) {
            console.warn(
              "[messages] fetchAllConversationMessages failed; using MongoDB cache",
              err
            );
            return storedRaws;
          }
          throw err;
        }
      })(),
      getOneConversation(
        accessToken,
        conversation.shop_id,
        conversationId,
        countryOpt
      ),
      getShopInfo(accessToken, conversation.shop_id, countryOpt),
    ]);

    if (msgResult.status === "rejected") {
      throw msgResult.reason;
    }
    const rawList = msgResult.value;

    // Non-blocking: re-evaluate auto-reply schedule from live message timestamps.
    // Catches cases where the webhook was missed, delayed, or the timer drifted.
    reviewAutoReplySchedule(rawList, conversation.shop_id, conversationId).catch(
      (e) => console.warn("[messages] reviewAutoReplySchedule:", e)
    );

    try {
      if (oneRes.status === "fulfilled" && oneRes.value) {
        const d = oneRes.value as Record<string, unknown>;
        const resp = d.response as Record<string, unknown> | undefined;
        const convObj = (resp?.conversation ?? resp ?? d) as Record<string, unknown>;
        const fromApi =
          extractBuyerAvatarFromShopee(convObj) ??
          (resp ? extractBuyerAvatarFromShopee(resp) : undefined) ??
          extractBuyerAvatarFromShopee(d);
        if (fromApi) customerAvatar = fromApi;

        // Extract products the buyer is inquiring about from the conversation object
        const rawInquired = extractInquiredItemsFromOneConversation(d);
        if (rawInquired.length > 0) {
          const inquiredItemIds = rawInquired
            .map((it) => Number(it.item_id))
            .filter((n) => Number.isFinite(n) && n > 0);

          // Enrich with catalog (name + image) when missing
          const needsEnrich = inquiredItemIds.filter((n) => {
            const raw = rawInquired.find((it) => Number(it.item_id) === n);
            return !raw?.name || !raw?.image_url;
          });

          let catalogMap = new Map<number, { name?: string; image_url?: string }>();
          if (needsEnrich.length > 0) {
            try {
              const { fetchItemCatalogMapByIds } = await import("@/lib/shopee-product-utils");
              catalogMap = await fetchItemCatalogMapByIds(
                accessToken,
                conversation.shop_id,
                needsEnrich,
                countryOpt
              );
            } catch (e) {
              console.warn("[messages] inquired item enrichment failed:", e);
            }
          }

          inquiredItems = rawInquired.map((it) => {
            const n = Number(it.item_id);
            const extra = Number.isFinite(n) && n > 0 ? catalogMap.get(n) : undefined;
            const shopIdForUrl = it.shop_id ?? String(conversation.shop_id);
            const item_url =
              it.item_id && shopIdForUrl
                ? buildBuyerItemUrl(countryResolved, shopIdForUrl, it.item_id)
                : undefined;
            return {
              item_id: it.item_id,
              shop_id: it.shop_id,
              name: extra?.name || it.name,
              image_url: extra?.image_url || it.image_url,
              item_url,
            };
          });
        }
      }

      if (shopRes.status === "fulfilled" && shopRes.value) {
        const logo = extractShopLogoFromShopInfo(
          shopRes.value as Record<string, unknown>
        );
        if (logo) shopLogo = logo;
      }
    } catch (e) {
      console.warn("[messages] avatar / shop logo enrichment:", e);
    }

    if (
      customerAvatar &&
      customerAvatar !== conversation.customer_avatar_url
    ) {
      await convCol.updateOne(
        {
          conversation_id: String(conversationId),
          shop_id: conversation.shop_id,
        },
        { $set: { customer_avatar_url: customerAvatar, updated_at: new Date() } }
      );
    }

    const messages = rawList.map((msg, index: number) => {
      const sender = inferChatMessageSender(
        msg,
        conversation.shop_id,
        conversation.customer_id
      );
      const isStaff = sender === "staff";
      const tsRaw = msg.timestamp ?? msg.created_timestamp ?? msg.time;
      const ms = shopeeMessageTimeToMs(tsRaw);
      const sec = ms / 1000;
      const dateKey = new Date(ms).toISOString().slice(0, 10);
      const datetime = new Date(ms).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const msgIdStr = String(msg.message_id ?? msg.id ?? index);
      const display = displayFromShopeeChatMessage(msg);

      // Debug: log raw payload when a message falls back to [bracket] format
      // so unknown Shopee message structures can be identified and handled.
      if (
        display.kind === "text" &&
        display.summary.startsWith("[") &&
        display.summary.endsWith("]")
      ) {
        console.log(
          `[messages-debug] unresolved bracket summary conv=${conversationId} msgId=${msgIdStr} summary=${display.summary}`,
          JSON.stringify(msg).slice(0, 800)
        );
      }
      const orderSn = display.order?.order_sn?.trim();
      const order_url =
        orderSn && orderSn.length >= 8
          ? buildSellerOrderUrl(countryResolved, orderSn)
          : undefined;
      const item = display.item;
      const shopIdForLink =
        item?.shop_id != null && String(item.shop_id).trim() !== ""
          ? String(item.shop_id)
          : String(conversation.shop_id);
      const item_url =
        item?.item_id && shopIdForLink
          ? buildBuyerItemUrl(
              countryResolved,
              shopIdForLink,
              item.item_id
            )
          : undefined;

      const tagged = isStaff ? staffKindByMessageId.get(msgIdStr) : undefined;
      let staff_send_kind:
        | "manual"
        | "template"
        | "auto"
        | "auto_hint"
        | "unknown"
        | undefined;
      if (isStaff) {
        if (tagged === "auto") staff_send_kind = "auto";
        else if (tagged === "manual") staff_send_kind = "manual";
        else if (tagged === "template") staff_send_kind = "template";
        else if (inferStaffMessageAutoHint(msg)) staff_send_kind = "auto_hint";
        else staff_send_kind = "unknown";
      }

      return {
        id: msgIdStr,
        sender: isStaff ? ("staff" as const) : ("customer" as const),
        content: display.summary,
        content_kind: display.kind,
        item_card: display.item,
        order_card: display.order,
        sticker_card: display.sticker,
        image_card: display.image,
        order_url,
        item_url,
        time: new Date(ms).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        datetime,
        date_key: dateKey,
        timestamp: sec,
        timestamp_ms: ms,
        staff_send_kind,
      };
    });

    const itemIdsForCatalog = messages
      .filter((m) => m.content_kind === "item" && m.item_card?.item_id)
      .map((m) => Number(m.item_card!.item_id))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (itemIdsForCatalog.length > 0) {
      const catalog = await fetchItemCatalogMapByIds(
        accessToken,
        conversation.shop_id,
        itemIdsForCatalog,
        countryOpt
      );
      for (const m of messages) {
        if (m.content_kind !== "item" || !m.item_card?.item_id) continue;
        const n = Number(m.item_card.item_id);
        const info = catalog.get(n);
        if (!info) continue;
        m.item_card = {
          ...m.item_card,
          name: info.name || m.item_card.name,
          image_url: info.image_url || m.item_card.image_url,
        };
        if (m.item_card.name) {
          m.content = `商品: ${m.item_card.name}`;
        }
      }
    }

    // Enrich order cards with product image/name from get_order_detail
    const orderSnsForEnrich = messages
      .filter((m) => m.content_kind === "order" && m.order_card?.order_sn)
      .map((m) => m.order_card!.order_sn!.trim())
      .filter(Boolean);

    if (orderSnsForEnrich.length > 0) {
      const orderItemMap = await fetchOrderItemInfoMap(
        accessToken,
        conversation.shop_id,
        orderSnsForEnrich,
        countryOpt
      );
      for (const m of messages) {
        if (m.content_kind !== "order" || !m.order_card?.order_sn) continue;
        const info = orderItemMap.get(m.order_card.order_sn.trim());
        if (!info) continue;
        m.order_card = {
          ...m.order_card,
          item_name: info.item_name,
          item_image_url: info.item_image_url,
          item_id: info.item_id,
        };
      }
    }

    messages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    return NextResponse.json({
      conversation: {
        id: conversationId,
        customer_name: conversation.customer_name,
        customer_id: conversation.customer_id,
        country: countryResolved,
        shop_id: conversation.shop_id,
        customer_avatar_url: customerAvatar,
        shop_logo_url: shopLogo,
        inquired_items: inquiredItems,
      },
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

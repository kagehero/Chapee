import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import {
  getConversationMessages,
  getOrderDetail,
  getOrderList,
} from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";
import { textFromShopeeChatMessage } from "@/lib/shopee-conversation-utils";
import {
  buildSellerOrderUrl,
  collectOrderSnCandidates,
} from "@/lib/shopee-order-utils";

type OrderRow = {
  order_sn: string;
  order_status: string;
  currency: string;
  total_amount: number;
  item_preview: string;
  item_count: number;
  order_url: string;
};

function mapDetailToRow(
  o: Record<string, unknown>,
  country: string
): OrderRow | null {
  const sn = String(o.order_sn ?? "").trim();
  if (!sn) return null;
  const list = Array.isArray(o.item_list) ? o.item_list : [];
  const first = list[0] as { item_name?: string; model_name?: string } | undefined;
  const preview =
    first?.item_name ||
    first?.model_name ||
    (list.length ? `${list.length} 点` : "");
  const totalRaw = o.total_amount ?? o.order_total_amount ?? o.actual_amount;
  const total =
    typeof totalRaw === "number"
      ? totalRaw
      : typeof totalRaw === "string"
        ? parseFloat(totalRaw)
        : 0;

  return {
    order_sn: sn,
    order_status: String(o.order_status ?? ""),
    currency: String(o.currency ?? ""),
    total_amount: Number.isFinite(total) ? total : 0,
    item_preview: preview,
    item_count: list.length,
    order_url: buildSellerOrderUrl(country, sn),
  };
}

/**
 * GET /api/chats/[id]/orders — 会話に関連する注文（メッセージ内 order_sn + バイヤー注文一覧）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    const convCol = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country: string;
      customer_id: number;
      customer_name: string;
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

    const accessToken = await getValidToken(conversation.shop_id);
    const country = conversation.country || "SG";
    const buyerId = Number(conversation.customer_id);

    const msgRes = await getConversationMessages(
      accessToken,
      conversation.shop_id,
      conversationId,
      { page_size: 100 }
    );

    const rawList =
      (msgRes.response?.messages ??
        msgRes.response?.message_list ??
        []) as Record<string, unknown>[];

    const textContents = rawList.map((msg) => textFromShopeeChatMessage(msg));
    const fromMessages = collectOrderSnCandidates(rawList, textContents);

    const now = Math.floor(Date.now() / 1000);
    const ninetyDays = 90 * 24 * 60 * 60;
    let fromListApi = new Set<string>();

    try {
      const listRes = (await getOrderList(accessToken, conversation.shop_id, {
        time_range_field: "create_time",
        time_from: now - ninetyDays,
        time_to: now,
        page_size: 100,
      })) as Record<string, unknown>;
      const listNested = listRes.response as
        | Record<string, unknown>
        | undefined;
      const orders = (listNested?.order_list ??
        listRes.order_list ??
        []) as Record<string, unknown>[];
      for (const row of orders) {
        const bid = Number(row.buyer_user_id ?? row.buyer_userid ?? 0);
        if (bid === buyerId && row.order_sn) {
          fromListApi.add(String(row.order_sn));
        }
      }
    } catch (e) {
      console.warn("[orders] get_order_list optional:", e);
    }

    const allSn = new Set<string>([...fromMessages, ...fromListApi]);
    const orderSnList = [...allSn].filter(Boolean).slice(0, 50);

    if (orderSnList.length === 0) {
      return NextResponse.json({
        country,
        orders: [] as OrderRow[],
      });
    }

    const linkOnly = (sns: string[]): OrderRow[] =>
      sns.map((sn) => ({
        order_sn: sn,
        order_status: "",
        currency: "",
        total_amount: 0,
        item_preview: "",
        item_count: 0,
        order_url: buildSellerOrderUrl(country, sn),
      }));

    let orders: OrderRow[] = [];
    try {
      const detailRes = (await getOrderDetail(
        accessToken,
        conversation.shop_id,
        orderSnList,
        ["item_list", "order_status", "total_amount", "currency"]
      )) as Record<string, unknown>;
      const detailNested = detailRes.response as
        | Record<string, unknown>
        | undefined;
      const detailList = (detailNested?.order_list ??
        detailRes.order_list ??
        []) as Record<string, unknown>[];

      for (const row of detailList) {
        const mapped = mapDetailToRow(row, country);
        if (mapped) orders.push(mapped);
      }
    } catch (e) {
      console.warn("[orders] get_order_detail fallback to links only:", e);
      orders = linkOnly(orderSnList);
    }

    if (orders.length === 0) {
      orders = linkOnly(orderSnList);
    }

    orders.sort((a, b) => b.order_sn.localeCompare(a.order_sn));

    return NextResponse.json({
      country,
      orders,
    });
  } catch (error) {
    console.error("GET /api/chats/[id]/orders:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "注文情報の取得に失敗しました",
      },
      { status: 500 }
    );
  }
}

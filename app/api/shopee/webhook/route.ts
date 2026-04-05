import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { handleAutoReplyOnWebhookMessage } from "@/lib/auto-reply";
import { syncWebhookConversationFull } from "@/lib/shopee-conversation-db-sync";

/**
 * Shopee Webhook Receiver
 * POST /api/shopee/webhook
 *
 * Shopee Open Platform の Live Push「Push Code」（公式の数値）と payload.code が対応します。
 * 例（抜粋・ドキュメント準拠）:
 * - 1  shop_authorization_push
 * - 2  shop_authorization_canceled_push
 * - 3  order_status_push
 * - 10 webchat_push（チャット／Webchat）
 * - 12 open_api_authorization_expiry
 * … ほかは Developer Console の Push 一覧を参照。
 *
 * 注意: 旧コメントの「1=新着メッセージ」は誤り。チャットは通常 code 10。
 * 実際の body は必ずログで確認し、data の形に合わせてハンドラを書くこと。
 *
 * Configure webhook URL in Shopee Open Platform:
 * https://yourdomain.com/api/shopee/webhook
 */
export async function POST(request: NextRequest) {

  try {
    const body = await request.text();

    const payload = JSON.parse(body);

    // Handle different webhook events（Push Code は Shopee コンソールの表に従う）
    switch (payload.code) {
      case 10: // webchat_push
        await handleNewMessage(payload.data);
        break;

      case 1: // shop_authorization_push
        console.log("[Webhook] Shop authorization");
        break;

      case 3: // order_status_push（必要なら別ハンドラ）
        break;

      default:
        console.log("[Webhook] Unknown event code:", payload.code);
    }

    return NextResponse.json({ message: "OK" }, { status: 200 });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

function numU(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strU(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/**
 * webchat_push（code 10）: Webhook の data は欠損しがちなため、
 * Shopee API で全メッセージ + get_one_conversation を取り、DB に同期してから自動返信を予約する。
 */
async function handleNewMessage(data: Record<string, unknown>) {
  try {
    const shopId = numU(data.shop_id ?? data.shopId);
    const conversationId = strU(data.conversation_id).trim();
    if (!shopId || !conversationId) {
      console.error(
        "[Webhook] handleNewMessage: missing shop_id or conversation_id",
        data
      );
      return;
    }

    console.log(`[Webhook] webchat_push conversation=${conversationId} shop=${shopId}`);

    const sync = await syncWebhookConversationFull(shopId, conversationId);
    if (!sync.ok) {
      console.error("[Webhook] syncWebhookConversationFull failed:", sync.error);
      return;
    }

    console.log(
      `[Webhook] DB synced ${sync.messageCount} messages for ${conversationId}`
    );

    const hint = sync.autoReplyHint;
    if (!hint) return;

    const fromId =
      numU(data.from_id) ||
      numU(data.from_user_id) ||
      hint.from_id;
    const toId = numU(data.to_id) || hint.to_id;
    const toName = strU(data.to_name) || hint.to_name;

    await handleAutoReplyOnWebhookMessage({
      shop_id: shopId,
      conversation_id: conversationId,
      to_id: toId,
      to_name: toName,
      from_id: fromId,
    });
  } catch (error) {
    console.error("[Webhook] handleNewMessage error:", error);
  }
}

/**
 * Handle conversation update (pin/unpin)
 */
async function handleConversationUpdate(data: {
  shop_id: number;
  conversation_id: string;
  pinned?: boolean;
}) {
  try {
    const { shop_id, conversation_id, pinned } = data;

    console.log(
      `[Webhook] Conversation ${conversation_id} ${pinned ? "pinned" : "unpinned"}`
    );

    const col = await getCollection("shopee_conversations");
    await col.updateOne(
      { conversation_id, shop_id },
      {
        $set: {
          pinned: pinned || false,
          updated_at: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("[Webhook] handleConversationUpdate error:", error);
  }
}

/**
 * GET /api/shopee/webhook - Webhook verification (if required by Shopee)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");

  if (challenge) {
    // Return challenge for webhook verification
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    message: "Shopee Webhook Endpoint",
    status: "active",
  });
}

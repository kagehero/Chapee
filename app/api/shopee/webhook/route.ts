import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection } from "@/lib/mongodb";
import { handleAutoReplyOnWebhookMessage } from "@/lib/auto-reply";

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

/**
 * Verify Shopee webhook signature
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!partnerKey) return false;

  const expectedSignature = crypto
    .createHmac("sha256", partnerKey)
    .update(body)
    .digest("hex");

  return signature === expectedSignature;
}

/**
 * Handle new message webhook
 */
async function handleNewMessage(data: {
  shop_id: number;
  conversation_id: string;
  to_id: number;
  to_name: string;
  message: string;
  message_id: string;
  timestamp: number;
  from_id: number;
}) {
  try {
    const {
      shop_id,
      conversation_id,
      to_id,
      to_name,
      message,
      message_id,
      timestamp,
      from_id,
    } = data;

    console.log(`[Webhook] New message in conversation ${conversation_id}`);

    const isStaff = Number(from_id) === Number(shop_id);
    const buyerId = isStaff ? to_id : from_id;

    const tokenCol = await getCollection<{ shop_id: number; country: string }>(
      "shopee_tokens"
    );
    const tokenRow = await tokenCol.findOne({ shop_id });
    const country = tokenRow?.country
      ? String(tokenRow.country).toUpperCase()
      : undefined;

    // Update conversation in database
    const col = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country?: string;
      customer_id: number;
      customer_name: string;
      last_message: string;
      last_message_time: Date;
      unread_count: number;
      status: string;
    }>("shopee_conversations");

    const setDoc: Record<string, unknown> = {
      customer_id: buyerId,
      last_message: message,
      last_message_time: new Date(timestamp * 1000),
      status: "active",
      updated_at: new Date(),
    };
    if (country) setDoc.country = country;
    if (isStaff && to_name) setDoc.customer_name = to_name;

    await col.updateOne(
      { conversation_id, shop_id },
      {
        $set: setDoc,
        ...(isStaff ? {} : { $inc: { unread_count: 1 } }),
        $setOnInsert: {
          conversation_id,
          shop_id,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    await handleAutoReplyOnWebhookMessage({
      shop_id,
      conversation_id,
      to_id,
      to_name,
      from_id,
    });

    console.log(`[Webhook] Conversation ${conversation_id} updated`);
  } catch (error) {
    console.error("[Webhook] handleNewMessage error:", error);
  }
}

/**
 * Handle message read webhook
 */
async function handleMessageRead(data: {
  shop_id: number;
  conversation_id: string;
}) {
  try {
    const { shop_id, conversation_id } = data;

    console.log(`[Webhook] Messages read in conversation ${conversation_id}`);

    const col = await getCollection("shopee_conversations");
    await col.updateOne(
      { conversation_id, shop_id },
      {
        $set: {
          unread_count: 0,
          updated_at: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("[Webhook] handleMessageRead error:", error);
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

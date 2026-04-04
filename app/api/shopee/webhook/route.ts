import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection } from "@/lib/mongodb";
import { handleAutoReplyOnWebhookMessage } from "@/lib/auto-reply";

/**
 * Shopee Webhook Receiver
 * POST /api/shopee/webhook
 * 
 * Receives real-time notifications from Shopee:
 * - New messages
 * - Order updates
 * - Shop status changes
 * 
 * Configure webhook URL in Shopee Open Platform:
 * https://yourdomain.com/api/shopee/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signatureHeader = extractWebhookSignatureHeader(request);

    if (!process.env.SHOPEE_PARTNER_KEY?.trim()) {
      console.error(
        "[Webhook] SHOPEE_PARTNER_KEY is not set (Vercel Environment Variables)"
      );
      return NextResponse.json(
        { error: "Server misconfiguration: partner key missing" },
        { status: 503 }
      );
    }

    // Verify webhook signature (Shopee は x-shopee-signature または Authorization)
    if (!verifyWebhookSignature(body, signatureHeader)) {
      console.error(
        "[Webhook] Invalid signature (check SHOPEE_PARTNER_KEY matches Open Platform)"
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!body.trim()) {
      return NextResponse.json({ success: true });
    }

    let payload: { code?: number; data?: unknown };
    try {
      payload = JSON.parse(body) as { code?: number; data?: unknown };
    } catch {
      console.warn("[Webhook] Non-JSON body; acknowledged");
      return NextResponse.json({ success: true });
    }
    console.log("[Webhook] Received event:", payload.code, payload);

    if (payload.code == null) {
      return NextResponse.json({ success: true });
    }

    // Handle different webhook events
    const data = payload.data;
    switch (payload.code) {
      case 1: // New message received
        if (data && typeof data === "object") {
          await handleNewMessage(
            data as Parameters<typeof handleNewMessage>[0]
          );
        }
        break;

      case 2: // Message read
        if (data && typeof data === "object") {
          await handleMessageRead(
            data as Parameters<typeof handleMessageRead>[0]
          );
        }
        break;

      case 3: // Conversation pinned/unpinned
        if (data && typeof data === "object") {
          await handleConversationUpdate(
            data as Parameters<typeof handleConversationUpdate>[0]
          );
        }
        break;

      case 10: // Shop authorization
        console.log("[Webhook] Shop authorization event");
        break;

      default:
        console.log("[Webhook] Unknown event code:", payload.code);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Shopee Push: 署名は raw body に対する HMAC-SHA256 hex。
 * ヘッダは `x-shopee-signature` が一般的。`Authorization` に付く場合もある。
 */
function extractWebhookSignatureHeader(request: NextRequest): string | null {
  const x =
    request.headers.get("x-shopee-signature") ??
    request.headers.get("X-Shopee-Signature");
  if (x?.trim()) return normalizeSignatureHeaderValue(x);
  const auth = request.headers.get("authorization");
  if (auth?.trim()) return normalizeSignatureHeaderValue(auth);
  return null;
}

function normalizeSignatureHeaderValue(value: string): string {
  const t = value.trim();
  if (/^bearer\s+/i.test(t)) {
    return t.replace(/^bearer\s+/i, "").trim();
  }
  return t;
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

  const a = expectedSignature.toLowerCase();
  const b = signature.toLowerCase();
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return a === b;
  }
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

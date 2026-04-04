import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCollection } from "@/lib/mongodb";
import { handleAutoReplyOnWebhookMessage } from "@/lib/auto-reply";

/** 署名検証をバイパスしない（Vercel / CDN のキャッシュで検証がおかしくなるのを防ぐ） */
export const dynamic = "force-dynamic";

/** Shopee の URL 検証・Push 成功応答は空ボディ 200 であることを期待する場合がある */
function okWebhookResponse(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

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
 *
 * OAuth の Redirect URL は別: https://yourdomain.com/api/shopee/callback （webhook と混同しない）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signatureHeader = extractWebhookSignatureHeader(request);
    const skipVerify = process.env.SHOPEE_WEBHOOK_SKIP_VERIFY === "1";
    const allowUnsigned =
      process.env.SHOPEE_WEBHOOK_ALLOW_UNSIGNED === "1";

    /** 接続テストで「ボディなし・署名なし」の POST が来ることがあり、先に 401 になるのを防ぐ */
    if (!body.trim() && !signatureHeader) {
      return okWebhookResponse();
    }

    if (!skipVerify && !process.env.SHOPEE_PARTNER_KEY?.trim()) {
      console.error(
        "[Webhook] SHOPEE_PARTNER_KEY is not set (Vercel Environment Variables)"
      );
      return NextResponse.json(
        { error: "Server misconfiguration: partner key missing" },
        { status: 503 }
      );
    }

    if (!skipVerify) {
      const okSig =
        signatureHeader &&
        verifyWebhookSignature(body, signatureHeader);
      const okUnsigned = !signatureHeader && allowUnsigned;
      if (!okSig && !okUnsigned) {
        logSignatureDebug(request, signatureHeader);
        console.error(
          "[Webhook] Invalid or missing signature (Partner Key と Open Platform のアプリが一致しているか確認。一時的に SHOPEE_WEBHOOK_ALLOW_UNSIGNED=1 で疎通のみ可)"
        );
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      if (okUnsigned) {
        console.warn(
          "[Webhook] SHOPEE_WEBHOOK_ALLOW_UNSIGNED=1 — 本番では無効化してください"
        );
      }
    } else {
      console.warn(
        "[Webhook] SHOPEE_WEBHOOK_SKIP_VERIFY=1 — 署名検証をスキップしています"
      );
    }

    if (!body.trim()) {
      return okWebhookResponse();
    }

    let payload: { code?: number; data?: unknown };
    try {
      payload = JSON.parse(body) as { code?: number; data?: unknown };
    } catch {
      console.warn("[Webhook] Non-JSON body; acknowledged");
      return okWebhookResponse();
    }
    console.log("[Webhook] Received event:", payload.code, payload);

    if (payload.code == null) {
      return okWebhookResponse();
    }

    // Handle different webhook events
    const data = payload.data;
    switch (payload.code) {
      case 1: // New message received
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data)
        ) {
          await handleNewMessage(
            data as Parameters<typeof handleNewMessage>[0]
          );
        }
        break;

      case 2: // Message read
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data)
        ) {
          await handleMessageRead(
            data as Parameters<typeof handleMessageRead>[0]
          );
        }
        break;

      case 3: // Conversation pinned/unpinned
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data)
        ) {
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

    return okWebhookResponse();
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Shopee Push: 署名は raw body に対する HMAC-SHA256（hex または base64）。
 * ヘッダ名はリージョン・世代で揺れるため複数候補を見る。
 */
function extractWebhookSignatureHeader(request: NextRequest): string | null {
  const names = [
    "x-shopee-signature",
    "x-signature",
    "authorization",
  ];
  for (const n of names) {
    const v = request.headers.get(n);
    if (v?.trim()) return normalizeSignatureHeaderValue(v);
  }
  return null;
}

function normalizeSignatureHeaderValue(value: string): string {
  let t = value.trim();
  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, "").trim();
  }
  for (const prefix of ["sha256=", "v1=", "hmac-sha256=", "sha256 "]) {
    if (t.toLowerCase().startsWith(prefix.toLowerCase())) {
      t = t.slice(prefix.length).trim();
      break;
    }
  }
  return t.replace(/^["']|["']$/g, "");
}

function logSignatureDebug(
  request: NextRequest,
  signatureHeader: string | null
): void {
  const keys = [...request.headers.keys()].filter((k) =>
    /sig|auth|shopee|token/i.test(k)
  );
  console.error(
    "[Webhook] Signature debug: hasSigHeader=",
    Boolean(signatureHeader),
    "relevantHeaderKeys=",
    keys
  );
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

  const h = crypto.createHmac("sha256", partnerKey).update(body, "utf8");
  const expectedHex = h.digest("hex");
  const expectedB64 = crypto
    .createHmac("sha256", partnerKey)
    .update(body, "utf8")
    .digest("base64");

  const sig = signature.trim();
  if (constantTimeEqualHex(expectedHex, sig)) return true;
  if (constantTimeEqualString(expectedB64, sig)) return true;
  /** base64 改行なし比較 */
  if (constantTimeEqualString(expectedB64, sig.replace(/\s+/g, "")))
    return true;
  return false;
}

function constantTimeEqualHex(aHex: string, b: string): boolean {
  const a = aHex.toLowerCase();
  const x = b.toLowerCase().replace(/^0x/, "");
  if (a.length !== x.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(x, "hex"));
  } catch {
    return a === x;
  }
}

function constantTimeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
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

    if (
      conversation_id == null ||
      String(conversation_id).trim() === "" ||
      shop_id == null ||
      !Number.isFinite(Number(shop_id))
    ) {
      console.warn(
        "[Webhook] handleNewMessage: missing conversation_id or shop_id, skip DB"
      );
      return;
    }

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
 * GET /api/shopee/webhook — URL 検証で challenge を返す場合がある（plain / JSON 両対応）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");

  if (challenge) {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("application/json")) {
      return NextResponse.json({ challenge });
    }
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    { message: "Shopee Webhook Endpoint", status: "active" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

/** 監視・LB のプローブ用 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

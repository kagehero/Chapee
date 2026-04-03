import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";
import { getCollection } from "@/lib/mongodb";
import { clearAutoReplySchedule } from "@/lib/auto-reply";
import {
  extractMessageIdFromSendResponse,
  recordStaffMessageKind,
} from "@/lib/staff-message-kind";

/**
 * POST /api/chats/[id]/send - Send message to customer via Shopee
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const body = (await request.json()) as {
      message?: string;
      /** UI: テンプレから送った場合は template */
      send_kind?: string;
    };
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "メッセージが空です" },
        { status: 400 }
      );
    }

    // Get conversation to find shop_id
    const col = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country: string;
      customer_name: string;
      customer_id: number;
    }>("shopee_conversations");

    const conversation = await col.findOne({
      conversation_id: String(conversationId),
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "会話が見つかりません" },
        { status: 404 }
      );
    }

    const toId = Number(conversation.customer_id);
    if (!Number.isFinite(toId) || toId <= 0) {
      return NextResponse.json(
        {
          error:
            "買い手のユーザーIDが取得できません。設定から「全店舗同期」を実行して会話を取り込み直してください。",
        },
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidToken(conversation.shop_id);

    // Send message via Shopee API（to_id = 会話の相手 = customer_id）
    const response = (await sendMessage(
      accessToken,
      conversation.shop_id,
      toId,
      message
    )) as Record<string, unknown>;

    const tagKind =
      body.send_kind === "template" ? ("template" as const) : ("manual" as const);
    const mid = extractMessageIdFromSendResponse(response);
    if (mid) {
      await recordStaffMessageKind(
        String(conversationId),
        conversation.shop_id,
        mid,
        tagKind
      );
    }

    // Update conversation last_message_time
    await col.updateOne(
      { conversation_id: String(conversationId) },
      {
        $set: {
          last_message: message,
          last_message_time: new Date(),
          unread_count: 0,
          updated_at: new Date(),
        },
      }
    );

    await clearAutoReplySchedule(conversationId, conversation.shop_id);

    return NextResponse.json({
      success: true,
      message: "メッセージを送信しました",
      data: response,
      message_id: mid ?? null,
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "メッセージ送信に失敗しました",
      },
      { status: 500 }
    );
  }
}

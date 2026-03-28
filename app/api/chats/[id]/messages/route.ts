import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { getConversationMessages } from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";
import {
  shopeeMessageTimeToMs,
  textFromShopeeChatMessage,
} from "@/lib/shopee-conversation-utils";

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

    // Get messages from Shopee API
    const accessToken = await getValidToken(conversation.shop_id);
    const response = await getConversationMessages(
      accessToken,
      conversation.shop_id,
      conversationId,
      {
        page_size: 25,
      }
    );

    const rawList =
      response.response?.messages ??
      response.response?.message_list ??
      [];

    const messages = (rawList as Record<string, unknown>[]).map(
      (msg, index: number) => {
        const fromId = Number(msg.from_id ?? msg.from_user_id ?? 0);
        const tsRaw = msg.timestamp ?? msg.created_timestamp ?? msg.time;
        const ms = shopeeMessageTimeToMs(tsRaw);
        const sec = ms / 1000;
        return {
          id: String(msg.message_id ?? msg.id ?? index),
          sender:
            fromId === conversation.shop_id
              ? ("staff" as const)
              : ("customer" as const),
          content: textFromShopeeChatMessage(msg),
          time: new Date(ms).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          timestamp: sec,
        };
      }
    );

    return NextResponse.json({
      conversation: {
        id: conversationId,
        customer_name: conversation.customer_name,
        customer_id: conversation.customer_id,
        country: conversation.country,
        shop_id: conversation.shop_id,
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

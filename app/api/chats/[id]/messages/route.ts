import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { getConversationMessages } from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";

/**
 * GET /api/chats/[id]/messages - Get messages for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Get conversation details
    const convCol = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country: string;
      customer_id: number;
      customer_name: string;
    }>("shopee_conversations");

    const conversation = await convCol.findOne({
      conversation_id: conversationId,
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
        page_size: 50,
      }
    );

    const shopeeMessages = response.response?.messages || [];

    type ShopeeMessage = {
      message_id?: string;
      from_id: number;
      message: string;
      timestamp: number;
    };

    // Transform messages
    const messages = shopeeMessages.map((msg: ShopeeMessage, index: number) => ({
      id: msg.message_id || index,
      sender: msg.from_id === conversation.shop_id ? "staff" : "customer",
      content: msg.message,
      time: new Date(msg.timestamp * 1000).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: msg.timestamp,
    }));

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

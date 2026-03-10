import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { getConversationMessages } from "@/lib/shopee-api";
import { getValidToken } from "@/lib/shopee-token";

// Feature flag: Set to true to use Shopee API, false to use mock data
const USE_REAL_API = false;

// Mock messages data
const MOCK_MESSAGES: Record<string, Array<{
  id: number;
  sender: "customer" | "staff";
  content: string;
  time: string;
  timestamp: number;
}>> = {
  "conv_sg_001": [
    { id: 1, sender: "customer", content: "こんにちは！注文した商品はいつ届きますか？", time: "10:00", timestamp: Date.now() / 1000 - 14400 },
    { id: 2, sender: "staff", content: "ご注文ありがとうございます。現在、発送準備中です。", time: "10:15", timestamp: Date.now() / 1000 - 13500 },
    { id: 3, sender: "customer", content: "追跡番号を教えていただけますか？", time: "11:30", timestamp: Date.now() / 1000 - 9000 },
    { id: 4, sender: "customer", content: "Please provide the tracking number as soon as possible.", time: "13:45", timestamp: Date.now() / 1000 - 1500 },
    { id: 5, sender: "customer", content: "I've been waiting for 3 days already.", time: "14:20", timestamp: Date.now() / 1000 - 300 },
  ],
  "conv_ph_001": [
    { id: 1, sender: "customer", content: "返品リクエストを送信しました", time: "13:10", timestamp: Date.now() / 1000 - 3900 },
    { id: 2, sender: "staff", content: "返品リクエストを確認しました。返品先住所をお送りします。", time: "13:15", timestamp: Date.now() / 1000 - 3600 },
  ],
  "conv_my_001": [
    { id: 1, sender: "customer", content: "商品に不具合がありました", time: "12:30", timestamp: Date.now() / 1000 - 6600 },
    { id: 2, sender: "customer", content: "返品したいです", time: "12:45", timestamp: Date.now() / 1000 - 5700 },
  ],
  "conv_th_001": [
    { id: 1, sender: "customer", content: "この商品の色違いはありますか？", time: "10:50", timestamp: Date.now() / 1000 - 12600 },
    { id: 2, sender: "customer", content: "色違いに変更できますか？", time: "10:55", timestamp: Date.now() / 1000 - 12300 },
  ],
  "conv_vn_001": [
    { id: 1, sender: "customer", content: "アフィリエイトプログラムについて教えてください", time: "16:00", timestamp: Date.now() / 1000 - 600 },
    { id: 2, sender: "staff", content: "ご興味ありがとうございます。アフィリエイトの詳細をお送りします。", time: "16:05", timestamp: Date.now() / 1000 - 300 },
    { id: 3, sender: "customer", content: "新商品のアフィリエイトについて", time: "16:10", timestamp: Date.now() / 1000 - 0 },
  ],
};

// Mock conversation data
const MOCK_CONVERSATIONS: Record<string, {
  id: string;
  customer_name: string;
  customer_id: number;
  country: string;
  shop_id: number;
}> = {
  "conv_sg_001": { id: "conv_sg_001", customer_name: "Lee Wei Ming", customer_id: 12345, country: "SG", shop_id: 1689220556 },
  "conv_ph_001": { id: "conv_ph_001", customer_name: "Shopee通知", customer_id: 99999, country: "PH", shop_id: 1689220556 },
  "conv_my_001": { id: "conv_my_001", customer_name: "Ahmad Farid", customer_id: 23456, country: "MY", shop_id: 1689220556 },
  "conv_sg_002": { id: "conv_sg_002", customer_name: "Shopee通知", customer_id: 99999, country: "SG", shop_id: 1689220556 },
  "conv_th_001": { id: "conv_th_001", customer_name: "Somchai K.", customer_id: 34567, country: "TH", shop_id: 1689220556 },
  "conv_vn_001": { id: "conv_vn_001", customer_name: "アフィリエイター ABC", customer_id: 88888, country: "VN", shop_id: 1689220556 },
  "conv_vn_002": { id: "conv_vn_002", customer_name: "Nguyen Van A", customer_id: 45678, country: "VN", shop_id: 1689220556 },
  "conv_my_002": { id: "conv_my_002", customer_name: "Shopee通知", customer_id: 99999, country: "MY", shop_id: 1689220556 },
  "conv_tw_001": { id: "conv_tw_001", customer_name: "Chen Wei", customer_id: 56789, country: "TW", shop_id: 1689220556 },
  "conv_br_001": { id: "conv_br_001", customer_name: "Silva Santos", customer_id: 67890, country: "BR", shop_id: 1689220556 },
};

/**
 * GET /api/chats/[id]/messages - Get messages for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Use mock data if API is not available
    if (!USE_REAL_API) {
      console.log(`[Messages API] Using mock data for conversation ${conversationId}`);
      
      const conversation = MOCK_CONVERSATIONS[conversationId];
      const messages = MOCK_MESSAGES[conversationId] || [];

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        conversation,
        messages,
      });
    }

    // Real API implementation (for future use)
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

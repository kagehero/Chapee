import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

// Feature flag: Set to true to use Shopee API, false to use mock data
const USE_REAL_API = false;

// Mock data for development
const MOCK_CHATS = [
  { id: "conv_sg_001", shop_id: 1689220556, country: "SG", customer: "Lee Wei Ming", customer_id: 12345, lastMessage: "商品はいつ届きますか？", time: "14:32", elapsed: 2.5, staff: "田中", status: "active", unread: 2, pinned: false, type: "buyer" },
  { id: "conv_ph_001", shop_id: 1689220556, country: "PH", customer: "Shopee通知", customer_id: 99999, lastMessage: "返品リクエストが届きました", time: "13:15", elapsed: 3.8, staff: "佐藤", status: "active", unread: 1, pinned: false, type: "notification" },
  { id: "conv_my_001", shop_id: 1689220556, country: "MY", customer: "Ahmad Farid", customer_id: 23456, lastMessage: "返品したいです", time: "12:45", elapsed: 4.3, staff: "未割当", status: "active", unread: 3, pinned: false, type: "buyer" },
  { id: "conv_sg_002", shop_id: 1689220556, country: "SG", customer: "Shopee通知", customer_id: 99999, lastMessage: "キャンセルリクエストが届きました", time: "11:20", elapsed: 5.7, staff: "山田", status: "resolved", unread: 0, pinned: false, type: "notification" },
  { id: "conv_th_001", shop_id: 1689220556, country: "TH", customer: "Somchai K.", customer_id: 34567, lastMessage: "色違いに変更できますか？", time: "10:55", elapsed: 6.1, staff: "未割当", status: "active", unread: 1, pinned: false, type: "buyer" },
  { id: "conv_vn_001", shop_id: 1689220556, country: "VN", customer: "アフィリエイター ABC", customer_id: 88888, lastMessage: "新商品のアフィリエイトについて", time: "16:10", elapsed: 0.8, staff: "鈴木", status: "resolved", unread: 0, pinned: false, type: "affiliate" },
  { id: "conv_vn_002", shop_id: 1689220556, country: "VN", customer: "Nguyen Van A", customer_id: 45678, lastMessage: "追跡番号を教えてください", time: "15:45", elapsed: 1.3, staff: "田中", status: "resolved", unread: 0, pinned: false, type: "buyer" },
  { id: "conv_my_002", shop_id: 1689220556, country: "MY", customer: "Shopee通知", customer_id: 99999, lastMessage: "商品が配達されました", time: "09:30", elapsed: 7.5, staff: "佐藤", status: "archived", unread: 0, pinned: false, type: "notification" },
  { id: "conv_tw_001", shop_id: 1689220556, country: "TW", customer: "Chen Wei", customer_id: 56789, lastMessage: "サイズ交換は可能ですか？", time: "08:15", elapsed: 8.8, staff: "山田", status: "resolved", unread: 0, pinned: false, type: "buyer" },
  { id: "conv_br_001", shop_id: 1689220556, country: "BR", customer: "Silva Santos", customer_id: 67890, lastMessage: "Quando chega o produto?", time: "07:30", elapsed: 9.5, staff: "田中", status: "active", unread: 1, pinned: false, type: "buyer" },
];

/**
 * GET /api/chats - Get all conversations from database or mock data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const searchQuery = searchParams.get("search")?.trim() ?? "";

    // Use mock data if API is not available
    if (!USE_REAL_API) {
      console.log("[Chats API] Using mock data");
      
      let filteredChats = [...MOCK_CHATS];
      
      if (country && country !== "全て") {
        filteredChats = filteredChats.filter(c => c.country === country);
      }
      if (status) {
        filteredChats = filteredChats.filter(c => c.status === status);
      }
      if (type) {
        filteredChats = filteredChats.filter(c => c.type === type);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase().replace(/\s+/g, " ");
        const tokens = q.split(" ").filter(Boolean);
        filteredChats = filteredChats.filter((c) => {
          const searchable = [c.customer, c.lastMessage].join(" ").toLowerCase().replace(/\s+/g, " ");
          return tokens.every((t) => searchable.includes(t));
        });
      }

      return NextResponse.json({ chats: filteredChats });
    }

    // Real API implementation (for future use)
    const col = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country: string;
      customer_id: number;
      customer_name: string;
      last_message: string;
      last_message_time: Date;
      unread_count: number;
      pinned: boolean;
      status: "active" | "resolved" | "archived";
      assigned_staff?: string;
      created_at: Date;
      updated_at: Date;
    }>("shopee_conversations");

    const filter: Record<string, string> = {};
    if (country && country !== "全て") filter.country = country;
    if (status) filter.status = status;

    const conversations = await col
      .find(filter)
      .sort({ last_message_time: -1 })
      .limit(100)
      .toArray();

    // Calculate elapsed time in hours
    const now = Date.now();
    const chats = conversations.map((conv) => {
      const elapsed =
        (now - conv.last_message_time.getTime()) / (1000 * 60 * 60);

      return {
        id: conv.conversation_id,
        shop_id: conv.shop_id,
        country: conv.country,
        customer: conv.customer_name,
        customer_id: conv.customer_id,
        lastMessage: conv.last_message,
        time: conv.last_message_time.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        elapsed: parseFloat(elapsed.toFixed(1)),
        staff: conv.assigned_staff || "未割当",
        unread: conv.unread_count,
        pinned: conv.pinned,
        status: conv.status,
      };
    });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Get chats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

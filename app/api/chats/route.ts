import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

/**
 * GET /api/chats - Get all conversations from database
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country");
    const status = searchParams.get("status");

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

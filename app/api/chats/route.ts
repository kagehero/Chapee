import type { Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

type ChatType = "buyer" | "notification" | "affiliate";

/**
 * GET /api/chats — conversations synced from Shopee (`shopee_conversations` in MongoDB)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const excludeChatTypesRaw = searchParams.get("exclude_chat_types");
    const searchQuery = searchParams.get("search")?.trim() ?? "";

    const limitRaw = parseInt(searchParams.get("limit") ?? "500", 10);
    const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 500));

    const col = await getCollection<{
      conversation_id: string;
      shop_id: number;
      country: string;
      customer_id: number;
      customer_name: string;
      last_message: string;
      last_message_time: Date;
      last_message_type?: string;
      chat_type?: ChatType;
      unread_count: number;
      pinned: boolean;
      status: "active" | "resolved" | "archived";
      assigned_staff?: string;
      created_at: Date;
      updated_at: Date;
    }>("shopee_conversations");

    type ConvDoc = {
      conversation_id: string;
      shop_id: number;
      country: string;
      customer_id: number;
      customer_name: string;
      last_message: string;
      last_message_time: Date;
      last_message_type?: string;
      chat_type?: ChatType;
      unread_count: number;
      pinned: boolean;
      status: "active" | "resolved" | "archived";
      assigned_staff?: string;
      created_at: Date;
      updated_at: Date;
    };

    const filterDoc: Filter<ConvDoc> = {};
    if (country && country !== "全て") filterDoc.country = country;
    if (
      status &&
      (status === "active" || status === "resolved" || status === "archived")
    ) {
      filterDoc.status = status;
    }

    const allowedTypes: ChatType[] = ["buyer", "notification", "affiliate"];
    if (type && allowedTypes.includes(type as ChatType)) {
      filterDoc.chat_type = type as ChatType;
    } else {
      const exclude = (excludeChatTypesRaw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is ChatType =>
          ["buyer", "notification", "affiliate"].includes(s)
        );
      if (exclude.length) filterDoc.chat_type = { $nin: exclude };
    }

    const conversations = await col
      .find(filterDoc)
      .sort({ last_message_time: -1 })
      .limit(limit)
      .toArray();

    const now = Date.now();
    let chats = conversations.map((conv) => {
      const elapsed =
        (now - conv.last_message_time.getTime()) / (1000 * 60 * 60);

      const uiStatus =
        conv.status === "archived"
          ? "closed"
          : conv.unread_count > 0
            ? "open"
            : "replied";

      return {
        id: conv.conversation_id,
        shop_id: conv.shop_id,
        country: conv.country,
        customer: conv.customer_name,
        customer_id: conv.customer_id,
        lastMessage: conv.last_message,
        product: "—",
        date: conv.last_message_time.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        time: conv.last_message_time.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        elapsed: parseFloat(elapsed.toFixed(1)),
        staff: conv.assigned_staff || "未割当",
        unread: conv.unread_count,
        pinned: conv.pinned,
        status: conv.status,
        uiStatus,
        type: conv.chat_type ?? "buyer",
      };
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/\s+/g, " ");
      const tokens = q.split(" ").filter(Boolean);
      chats = chats.filter((c) => {
        const searchable = [c.customer, c.lastMessage, c.product]
          .join(" ")
          .toLowerCase()
          .replace(/\s+/g, " ");
        return tokens.every((t) => searchable.includes(t));
      });
    }

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Get chats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

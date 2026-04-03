import type { Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { lastStaffKindFromLog } from "@/lib/staff-message-kind";

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
    const unreadOnly =
      searchParams.get("unread_only") === "1" ||
      searchParams.get("unread_only") === "true";

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
      staff_message_kind_log?: { id: string; kind: string }[];
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
      staff_message_kind_log?: { id: string; kind: string }[];
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

    if (unreadOnly) {
      filterDoc.unread_count = { $gt: 0 };
    }

    const conversations = await col
      .find(filterDoc)
      .sort({ last_message_time: -1 })
      .limit(limit)
      .toArray();

    /** 未読優先 → その後は最新アクティビティ順 */
    conversations.sort((a, b) => {
      const ua = a.unread_count > 0 ? 1 : 0;
      const ub = b.unread_count > 0 ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return b.last_message_time.getTime() - a.last_message_time.getTime();
    });

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

      const lastKind = lastStaffKindFromLog(conv.staff_message_kind_log);

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
        last_staff_send_kind: lastKind ?? null,
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

import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import {
  type HandlingStatus,
  isHandlingStatus,
} from "@/lib/handling-status";

/**
 * PATCH /api/chats/[id] — 対応ステータス（handling_status）の更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const body = (await request.json()) as { handling_status?: unknown };

    if (!isHandlingStatus(body.handling_status)) {
      return NextResponse.json(
        { error: "handling_status が不正です" },
        { status: 400 }
      );
    }

    const status = body.handling_status as HandlingStatus;

    const col = await getCollection<{
      conversation_id: string;
      shop_id: number;
    }>("shopee_conversations");

    const result = await col.updateOne(
      { conversation_id: String(conversationId) },
      {
        $set: {
          handling_status: status,
          updated_at: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "会話が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, handling_status: status });
  } catch (error) {
    console.error("PATCH /api/chats/[id]", error);
    return NextResponse.json(
      { error: "更新に失敗しました" },
      { status: 500 }
    );
  }
}

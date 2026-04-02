import { NextRequest, NextResponse } from "next/server";
import { processDueAutoReplies } from "@/lib/auto-reply";

/**
 * GET /api/cron/auto-reply
 * 期限到来の自動返信を送信。5〜15分ごとに cron から呼び出す想定。
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await processDueAutoReplies();
    console.log("[cron/auto-reply]", results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[cron/auto-reply]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Auto-reply job failed",
      },
      { status: 500 }
    );
  }
}

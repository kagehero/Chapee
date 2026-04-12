import { NextRequest, NextResponse } from "next/server";
import { processDueAutoReplies } from "@/lib/auto-reply";

/**
 * GET /api/cron/auto-reply
 * 期限到来の自動返信を送信。
 *
 * Vercel Cron の制限:
 * - Hobby: 1日1回まで（それ以上の頻度の式はデプロイ失敗）。vercel.json は日次に合わせている。
 * - Pro/Enterprise: 分単位まで設定可能。短い間隔が必要なら vercel.json の schedule を
 *   10 分間隔などの式に変更する。
 *
 * Hobby で数分おきに処理したい場合: 外部 cron（cron-job.org 等）から同 URL を
 * Authorization: Bearer CRON_SECRET と同じ値で叩く。
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

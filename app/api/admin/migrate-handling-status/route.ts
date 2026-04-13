import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import {
  type HandlingStatus,
  isHandlingStatus,
  resolveHandlingStatus,
} from "@/lib/handling-status";

/**
 * POST /api/admin/migrate-handling-status
 *
 * handling_status が未設定のドキュメントに resolveHandlingStatus() を適用して一括セットする。
 * Authorization: Bearer ${CRON_SECRET}
 *
 * dry_run=true を body に渡すと DB 更新せず件数だけ返す。
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    dry_run?: boolean;
  };
  const dryRun = body.dry_run === true;

  const col = await getCollection<{
    conversation_id: string;
    shop_id: number;
    handling_status?: HandlingStatus;
    unread_count?: number;
    staff_message_kind_log?: { id: string; kind: string }[];
    last_message_time?: Date;
    last_buyer_message_time?: Date;
    auto_reply_pending?: boolean;
    last_auto_reply_at?: Date | null;
  }>("shopee_conversations");

  const docs = await col
    .find({ handling_status: { $exists: false } })
    .toArray();

  const counts: Record<HandlingStatus, number> = {
    unreplied: 0,
    auto_replied_pending: 0,
    in_progress: 0,
    completed: 0,
  };

  const updates: { id: string; status: HandlingStatus }[] = [];

  for (const doc of docs) {
    // auto_reply_pending=true のものは auto_replied_pending 扱い
    const storedStatus: HandlingStatus | undefined =
      doc.auto_reply_pending || doc.last_auto_reply_at
        ? "auto_replied_pending"
        : undefined;

    const resolved = resolveHandlingStatus({
      handling_status: storedStatus,
      unread_count: Math.max(0, Number(doc.unread_count ?? 0)),
      staff_message_kind_log: doc.staff_message_kind_log,
      last_message_time:
        doc.last_message_time instanceof Date ? doc.last_message_time : undefined,
      last_buyer_message_time:
        doc.last_buyer_message_time instanceof Date
          ? doc.last_buyer_message_time
          : undefined,
    });

    if (!isHandlingStatus(resolved)) continue;
    counts[resolved]++;
    updates.push({ id: doc.conversation_id, status: resolved });
  }

  if (!dryRun && updates.length > 0) {
    for (const { id, status } of updates) {
      await col.updateOne(
        { conversation_id: id, handling_status: { $exists: false } },
        { $set: { handling_status: status, updated_at: new Date() } }
      );
    }
  }

  console.log(
    `[migrate-handling-status] dry_run=${dryRun} total=${updates.length}`,
    counts
  );

  return NextResponse.json({
    success: true,
    dry_run: dryRun,
    total: updates.length,
    counts,
  });
}

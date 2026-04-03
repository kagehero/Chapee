import { getCollection } from "@/lib/mongodb";

const COL = "shopee_sync_snapshots" as const;

/** 直近の同期成功時点の「アーカイブ」スナップショット（次回と比較して新着を検出） */
export type ShopSyncSnapshotDoc = {
  shop_id: number;
  /** conversation_id -> last_message_timestamp（Shopee の値を文字列で保持） */
  conv_last_ts: Record<string, string>;
  /** 直近取得した Seller Center 通知 ID（先頭ページ分） */
  notification_ids: string[];
  updated_at: Date;
};

export type SyncDelta = {
  /** 前回スナップショット以降にアクティビティがあった会話 ID */
  new_conversation_ids: string[];
  /** 前回に無かった Seller Center 通知 ID */
  new_notification_ids: string[];
};

export async function getSyncSnapshot(
  shopId: number
): Promise<ShopSyncSnapshotDoc | null> {
  const col = await getCollection<ShopSyncSnapshotDoc>(COL);
  return col.findOne({ shop_id: shopId });
}

export async function saveSyncSnapshot(
  shopId: number,
  convLastTs: Record<string, string>,
  notificationIds: string[]
): Promise<void> {
  const col = await getCollection<ShopSyncSnapshotDoc>(COL);
  await col.updateOne(
    { shop_id: shopId },
    {
      $set: {
        conv_last_ts: convLastTs,
        notification_ids: notificationIds,
        updated_at: new Date(),
      },
    },
    { upsert: true }
  );
}

type ConvRow = {
  conversation_id: string;
  last_message_timestamp: number;
};

/** 前回保存したスナップショットと比較し、新規または最終メッセージ時刻が進んだ会話を列挙 */
export function computeNewConversationActivity(
  prev: ShopSyncSnapshotDoc | null,
  conversations: ConvRow[]
): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const c of conversations) {
    const id = String(c.conversation_id);
    const ts = Number(c.last_message_timestamp);
    if (!Number.isFinite(ts)) continue;
    const oldRaw = prev.conv_last_ts[id];
    if (oldRaw === undefined) {
      out.push(id);
      continue;
    }
    const oldTs = Number(oldRaw);
    if (Number.isFinite(oldTs) && ts > oldTs) out.push(id);
  }
  return out;
}

/** 前回保存した通知 ID 集合に無い ID を新着とみなす */
export function computeNewNotificationIds(
  prevIds: string[] | undefined,
  currentIds: string[]
): string[] {
  if (!prevIds?.length) return [];
  const prevSet = new Set(prevIds);
  return dedupeStrings(currentIds).filter((id) => !prevSet.has(id));
}

function dedupeStrings(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 同期完了後に保存する会話タイムスタンプマップ */
export function buildConvLastTsMap(
  conversations: ConvRow[]
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const c of conversations) {
    m[String(c.conversation_id)] = String(c.last_message_timestamp);
  }
  return m;
}

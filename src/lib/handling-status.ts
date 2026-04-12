import { lastStaffKindFromLog } from "@/lib/staff-message-kind-log";

/**
 * チャット対応ステータス（一覧フィルター・一覧表示・詳細で共通）
 */
export type HandlingStatus =
  | "unreplied"
  | "auto_replied_pending"
  | "in_progress"
  | "completed";

export const HANDLING_STATUS_VALUES: HandlingStatus[] = [
  "unreplied",
  "auto_replied_pending",
  "in_progress",
  "completed",
];

export function isHandlingStatus(v: unknown): v is HandlingStatus {
  return (
    typeof v === "string" &&
    (HANDLING_STATUS_VALUES as string[]).includes(v)
  );
}

export const HANDLING_STATUS_LABELS: Record<HandlingStatus, string> = {
  unreplied: "未返信",
  auto_replied_pending: "自動返信済み",
  in_progress: "対応中",
  completed: "対応完了",
};

/** 一覧行の左ボーダー + 淡い背景 */
export const HANDLING_STATUS_ROW_STYLE: Record<HandlingStatus, string> = {
  unreplied: "border-l-4 border-l-red-500 bg-red-50/35",
  auto_replied_pending: "border-l-4 border-l-amber-500 bg-amber-50/30",
  in_progress: "border-l-4 border-l-sky-600 bg-sky-50/25",
  completed: "border-l-4 border-l-emerald-600/50 bg-emerald-50/15",
};

/** バッジ用 */
export const HANDLING_STATUS_BADGE_STYLE: Record<HandlingStatus, string> = {
  unreplied: "text-red-800 bg-red-100 border-red-200",
  auto_replied_pending: "text-amber-900 bg-amber-100 border-amber-200",
  in_progress: "text-sky-900 bg-sky-100 border-sky-200",
  completed: "text-emerald-900 bg-emerald-100 border-emerald-200",
};

type ConvLike = {
  handling_status?: HandlingStatus;
  unread_count: number;
  staff_message_kind_log?: { id: string; kind: string }[];
  /** 会話一覧・DB 同期で保持。最終アクティビティがバイヤーか推定するのに使用 */
  last_message_time?: Date;
  last_buyer_message_time?: Date;
};

export type ResolveHandlingOpts = {
  /**
   * 生メッセージ一覧から算出した「最終メッセージがバイヤー」。
   * 指定時は DB の時刻より優先（GET /messages など）。
   */
  buyer_last_message_is_latest?: boolean | null;
};

/** `last_message_time` と `last_buyer_message_time` が同一なら、最終発言はバイヤーとみなす */
export function buyerIsLastActivityFromTimestamps(
  lastMessageTime?: Date | null,
  lastBuyerMessageTime?: Date | null
): boolean {
  if (!(lastMessageTime instanceof Date) || !(lastBuyerMessageTime instanceof Date)) {
    return false;
  }
  return Math.abs(lastMessageTime.getTime() - lastBuyerMessageTime.getTime()) < 5000;
}

/**
 * 未読は最優先。次に「対応完了等だが最終発言がバイヤー」なら未返信に戻す。
 * それ以外は DB の handling_status → 未設定時はログから推定。
 */
export function resolveHandlingStatus(
  conv: ConvLike,
  opts?: ResolveHandlingOpts
): HandlingStatus {
  const unread = Math.max(0, Number(conv.unread_count ?? 0));
  if (unread > 0) return "unreplied";

  const buyerLast =
    opts?.buyer_last_message_is_latest ??
    buyerIsLastActivityFromTimestamps(
      conv.last_message_time,
      conv.last_buyer_message_time
    );

  const stored = conv.handling_status;
  if (
    buyerLast &&
    (stored === "completed" ||
      stored === "in_progress" ||
      stored === "auto_replied_pending")
  ) {
    return "unreplied";
  }

  /** DB に一度も保存されていないが、最終発言がバイヤー＝未返信 */
  if (buyerLast && !stored) {
    return "unreplied";
  }

  if (stored && isHandlingStatus(stored)) {
    return stored;
  }

  const lastKind = lastStaffKindFromLog(conv.staff_message_kind_log);
  if (lastKind === "auto") return "auto_replied_pending";
  if (lastKind === "manual" || lastKind === "template") return "in_progress";
  return "completed";
}

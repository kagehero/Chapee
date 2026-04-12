/**
 * staff_message_kind_log の純粋な解釈（mongodb を import しない — クライアントバンドル対応）
 */
export type StaffMessageKindTag = "manual" | "template" | "auto";

const VALID_KINDS = new Set<StaffMessageKindTag>(["manual", "template", "auto"]);

/** ログ末尾＝直近の店舗送信の種別（一覧表示用） */
export function lastStaffKindFromLog(
  log: Array<{ kind?: string }> | undefined
): StaffMessageKindTag | undefined {
  if (!log?.length) return undefined;
  const last = log[log.length - 1];
  const k = last?.kind as StaffMessageKindTag | undefined;
  return k && VALID_KINDS.has(k) ? k : undefined;
}

/** ログから message_id → 最後に記録された kind（上書き優先） */
export function kindMapFromLog(
  log: Array<{ id?: string; kind?: string }> | undefined
): Map<string, StaffMessageKindTag> {
  const m = new Map<string, StaffMessageKindTag>();
  if (!log?.length) return m;
  for (const row of log) {
    const k = row?.kind as StaffMessageKindTag;
    if (row?.id && k && VALID_KINDS.has(k)) m.set(String(row.id), k);
  }
  return m;
}

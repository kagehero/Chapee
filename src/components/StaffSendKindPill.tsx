import { cn } from "@/lib/utils";

export type LastStaffSendKind = "manual" | "template" | "auto";

export function StaffSendKindPill({
  kind,
  emptyLabel = "—",
}: {
  kind: LastStaffSendKind | null | undefined;
  /** Chapee 以外で送信した場合などログが無いとき */
  emptyLabel?: string;
}) {
  if (!kind) {
    return (
      <span className="text-[11px] text-muted-foreground tabular-nums" title="Chapee未記録の送信">
        {emptyLabel}
      </span>
    );
  }
  const cfg =
    kind === "manual"
      ? {
          label: "手動返信",
          className: "bg-slate-100 text-slate-800 border-slate-200",
        }
      : kind === "template"
        ? {
            label: "テンプレ",
            className: "bg-violet-50 text-violet-900 border-violet-200",
          }
        : {
            label: "自動返信",
            className: "bg-emerald-50 text-emerald-900 border-emerald-200",
          };
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

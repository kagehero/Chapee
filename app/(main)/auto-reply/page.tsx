"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Zap,
  Clock,
  Globe,
  ChevronRight,
  Info,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COUNTRIES = ["SG", "PH", "MY", "TW", "TH", "VN", "BR"];
const ORDER_STATUSES = ["注文受付", "発送準備中", "発送済み", "配達中", "配達完了", "キャンセル"];

type ReplyTemplateRow = {
  id: string;
  country: string;
  category: string;
  name: string;
  content: string;
  autoReply: boolean;
  langs: string[];
};

type CountryConfig = {
  enabled: boolean;
  triggerHour: number;
  statuses: string[];
  /** `reply_templates` の _id 文字列 */
  template_id: string;
  subAccounts?: { id: string; name: string; enabled: boolean }[];
};

function filterTemplatesForCountry(
  rows: ReplyTemplateRow[],
  country: string
): ReplyTemplateRow[] {
  const list = rows.filter(
    (t) => t.country === "全て" || t.country === country
  );
  return [...list].sort((a, b) => {
    if (a.autoReply !== b.autoReply) return a.autoReply ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
}

function pickDefaultTemplateId(
  rows: ReplyTemplateRow[],
  country: string
): string {
  const filtered = filterTemplatesForCountry(rows, country);
  const preferred = filtered.find((t) => t.autoReply);
  return (preferred ?? filtered[0])?.id ?? "";
}

const defaultCountryConfig = (): CountryConfig => ({
  enabled: false,
  triggerHour: 3,
  statuses: ["注文受付"],
  template_id: "",
  subAccounts: [],
});

export default function AutoReplyPage() {
  const [templates, setTemplates] = useState<ReplyTemplateRow[]>([]);
  const [configs, setConfigs] = useState<Record<string, CountryConfig>>(() =>
    Object.fromEntries(COUNTRIES.map((c) => [c, defaultCountryConfig()]))
  );
  const [selectedCountry, setSelectedCountry] = useState("SG");
  const [showSubAccounts, setShowSubAccounts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cfg = configs[selectedCountry];

  const templatesForCountry = useMemo(
    () => filterTemplatesForCountry(templates, selectedCountry),
    [templates, selectedCountry]
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === cfg.template_id),
    [templates, cfg.template_id]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, arRes] = await Promise.all([
        fetch("/api/reply-templates"),
        fetch("/api/settings/auto-reply"),
      ]);

      if (!tplRes.ok) throw new Error("templates");
      const tplData = (await tplRes.json()) as { templates?: ReplyTemplateRow[] };
      const rows = tplData.templates ?? [];
      setTemplates(rows);

      let serverCountries: Record<string, CountryConfig> = {};
      if (arRes.ok) {
        const arData = (await arRes.json()) as {
          countries?: Record<string, CountryConfig>;
        };
        serverCountries = arData.countries ?? {};
      } else if (arRes.status === 401) {
        toast.error("ログインが必要です");
      }

      const merged: Record<string, CountryConfig> = {};
      for (const c of COUNTRIES) {
        const saved = serverCountries[c];
        const defaultId = pickDefaultTemplateId(rows, c);
        const tid = saved?.template_id;
        const validId = tid && rows.some((r) => r.id === tid) ? tid : defaultId;
        merged[c] = {
          enabled: saved?.enabled ?? false,
          triggerHour:
            typeof saved?.triggerHour === "number"
              ? saved.triggerHour
              : defaultCountryConfig().triggerHour,
          statuses:
            Array.isArray(saved?.statuses) && saved.statuses.length > 0
              ? saved.statuses
              : defaultCountryConfig().statuses,
          template_id: validId,
          subAccounts: Array.isArray(saved?.subAccounts)
            ? saved.subAccounts
            : [],
        };
      }
      setConfigs(merged);
    } catch {
      toast.error("設定の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /** 国を切り替えたとき、選択中テンプレがその国向け一覧に無ければ差し替え */
  useEffect(() => {
    if (templates.length === 0) return;
    setConfigs((prev) => {
      const row = prev[selectedCountry];
      const list = filterTemplatesForCountry(templates, selectedCountry);
      if (list.some((t) => t.id === row.template_id)) return prev;
      return {
        ...prev,
        [selectedCountry]: {
          ...row,
          template_id: pickDefaultTemplateId(templates, selectedCountry),
        },
      };
    });
  }, [selectedCountry, templates]);

  const updateConfig = (key: keyof CountryConfig, value: unknown) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedCountry]: { ...prev[selectedCountry], [key]: value },
    }));
  };

  const toggleStatus = (status: string) => {
    const curr = cfg.statuses;
    const next = curr.includes(status)
      ? curr.filter((s) => s !== status)
      : [...curr, status];
    updateConfig("statuses", next);
  };

  const toggleSubAccount = (subId: string) => {
    const updated = cfg.subAccounts?.map((sub) =>
      sub.id === subId ? { ...sub, enabled: !sub.enabled } : sub
    );
    updateConfig("subAccounts", updated);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/auto-reply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countries: configs }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("ログインが必要です");
          return;
        }
        throw new Error();
      }
      toast.success("保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-muted-foreground">
        <Loader2 className="animate-spin size-6" />
        <span className="text-sm">読み込み中…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl w-full min-w-0">
      <div className="min-w-0">
        <h2 className="text-foreground font-bold text-lg">自動返信設定</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          国別の条件と、テンプレート管理（reply_templates）に登録した本文を使用します
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-7 gap-3">
          {COUNTRIES.map((country) => {
            const c = configs[country];
            return (
              <button
                key={country}
                type="button"
                onClick={() => setSelectedCountry(country)}
                className={cn(
                  "relative rounded-xl p-4 border-2 transition-all min-h-[80px] flex flex-col items-center justify-center",
                  selectedCountry === country
                    ? "bg-primary border-primary shadow-md"
                    : "bg-white border-gray-200 hover:border-primary/50"
                )}
              >
                <p
                  className={cn(
                    "font-bold text-lg mb-2",
                    selectedCountry === country ? "text-white" : "text-gray-900"
                  )}
                >
                  {country}
                </p>
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium",
                    selectedCountry === country ? "text-white/90" : "text-gray-600"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      c.enabled
                        ? selectedCountry === country
                          ? "bg-white"
                          : "bg-success"
                        : "bg-gray-400"
                    )}
                  />
                  <span>{c.enabled ? "ON" : "OFF"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
        <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Globe size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-gray-900 font-bold text-base">{selectedCountry}</p>
                <p className="text-gray-500 text-sm">メインアカウント</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 text-sm font-medium">
                {cfg.enabled ? "有効" : "無効"}
              </span>
              <Switch
                checked={cfg.enabled}
                onCheckedChange={(v) => updateConfig("enabled", v)}
              />
            </div>
          </div>
        </div>

        {cfg.subAccounts && cfg.subAccounts.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setShowSubAccounts(!showSubAccounts)}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={18}
                  className={cn(
                    "text-gray-600 transition-transform",
                    showSubAccounts && "rotate-180"
                  )}
                />
                <span className="text-gray-700 font-semibold text-sm">サブアカウント一覧</span>
                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                  {cfg.subAccounts.length}件
                </span>
              </div>
            </button>

            {showSubAccounts && (
              <div className="px-5 pb-4 space-y-2">
                {cfg.subAccounts.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-600 text-xs font-bold">SUB</span>
                      </div>
                      <span className="text-gray-900 font-medium text-sm">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs font-medium">
                        {sub.enabled ? "有効" : "無効"}
                      </span>
                      <Switch
                        checked={sub.enabled}
                        onCheckedChange={() => toggleSubAccount(sub.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "p-5 space-y-6 transition-opacity",
            !cfg.enabled && "opacity-50 pointer-events-none"
          )}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock size={16} className="text-primary" />
              </div>
              <Label className="text-gray-900 font-semibold text-sm">自動返信発動時間</Label>
            </div>
            <p className="text-gray-600 text-xs">未返信が指定時間を超えたときに自動返信します</p>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={11}
                value={cfg.triggerHour}
                onChange={(e) => updateConfig("triggerHour", Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <div className="w-24 text-center bg-primary/5 rounded-xl px-3 py-2 border border-primary/20">
                <span className="text-2xl font-bold text-primary">{cfg.triggerHour}</span>
                <span className="text-sm text-gray-600 ml-1">時間</span>
              </div>
            </div>

            <div className="flex justify-between text-xs text-gray-500 px-0.5">
              <span>1h</span>
              <span>6h</span>
              <span>11h</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <Zap size={16} className="text-primary" />
              </div>
              <Label className="text-gray-900 font-semibold text-sm">注文ステータス連動</Label>
            </div>
            <p className="text-gray-600 text-xs">選択したステータスの注文のみ自動返信します</p>

            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((status) => {
                const selected = cfg.statuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2",
                      selected
                        ? "bg-primary text-white border-primary shadow-md"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                    )}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <ChevronRight size={16} className="text-primary" />
              </div>
              <Label className="text-gray-900 font-semibold text-sm">使用テンプレート</Label>
            </div>
            <p className="text-gray-600 text-xs">
              テンプレート管理と同じ一覧です（この国向け・「全て」）。自動返信向けにチェックしたものは上に並びます。
            </p>

            {templatesForCountry.length === 0 ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {selectedCountry} 向けのテンプレートがありません。テンプレート画面で国を「全て」または
                {selectedCountry} にして追加してください。
              </p>
            ) : (
              <>
                <select
                  value={cfg.template_id}
                  onChange={(e) => updateConfig("template_id", e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {templatesForCountry.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.autoReply ? "★ " : ""}
                      {t.name}（{t.category}）
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {selectedTemplate.content}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
            <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-900 text-xs leading-relaxed">
              本文はテンプレート画面で編集すると、ここでも次回読み込み時に反映されます。自動送信の実行は別途バックエンド連携が必要です。
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl px-6"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin size-4 mr-2" />
                  保存中…
                </>
              ) : (
                "設定を保存"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

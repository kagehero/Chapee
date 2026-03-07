"use client";

import { useState } from "react";
import { Zap, Clock, Globe, ChevronRight, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const COUNTRIES = ["SG", "PH", "MY", "TW", "TH", "ID", "VN", "BR"];
const ORDER_STATUSES = ["注文受付", "発送準備中", "発送済み", "配達中", "配達完了", "キャンセル"];

type CountryConfig = {
  enabled: boolean;
  triggerHour: number;
  statuses: string[];
  template: string;
};

const defaultConfig: CountryConfig = {
  enabled: false,
  triggerHour: 3,
  statuses: ["注文受付"],
  template: "営業時間外の自動返信",
};

export default function AutoReplyPage() {
  const [configs, setConfigs] = useState<Record<string, CountryConfig>>(
    Object.fromEntries(COUNTRIES.map(c => [c, {
      ...defaultConfig,
      enabled: c === "SG" || c === "MY",
      triggerHour: c === "SG" ? 2 : c === "MY" ? 4 : 3,
    }]))
  );
  const [selectedCountry, setSelectedCountry] = useState("SG");

  const cfg = configs[selectedCountry];

  const updateConfig = (key: keyof CountryConfig, value: unknown) => {
    setConfigs(prev => ({
      ...prev,
      [selectedCountry]: { ...prev[selectedCountry], [key]: value }
    }));
  };

  const toggleStatus = (status: string) => {
    const curr = cfg.statuses;
    const next = curr.includes(status) ? curr.filter(s => s !== status) : [...curr, status];
    updateConfig("statuses", next);
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in max-w-4xl w-full min-w-0">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-foreground font-bold text-base sm:text-lg">自動返信設定</h2>
        <p className="text-muted-foreground text-sm mt-0.5">国別に自動返信の条件と内容を設定します</p>
      </div>

      {/* Country Selector */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        {COUNTRIES.map(country => {
          const c = configs[country];
          return (
            <button
              key={country}
              onClick={() => setSelectedCountry(country)}
              className={cn(
                "relative rounded-xl p-3 border transition-all min-h-[64px] sm:min-h-0",
                selectedCountry === country
                  ? "gradient-primary border-transparent shadow-green"
                  : "bg-card border-border hover:border-primary/30 shadow-card"
              )}
            >
              <p className={cn(
                "font-bold text-sm mb-1",
                selectedCountry === country ? "text-primary-foreground" : "text-foreground"
              )}>{country}</p>
              <div className={cn(
                "flex items-center gap-1",
                selectedCountry === country ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  c.enabled ? "bg-success" : "bg-muted-foreground/40"
                )} />
                <span className="text-xs">{c.enabled ? "ON" : "OFF"}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Config Panel */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden min-w-0">
        {/* Panel Header */}
        <div className="px-3 sm:px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gradient-primary">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
              <Globe size={14} className="text-primary-foreground" />
            </div>
            <p className="text-primary-foreground font-bold">{selectedCountry} 自動返信設定</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-primary-foreground/80 text-sm">
              {cfg.enabled ? "有効" : "無効"}
            </span>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={v => updateConfig("enabled", v)}
              className="data-[state=checked]:bg-primary-foreground data-[state=unchecked]:bg-primary-foreground/30"
            />
          </div>
        </div>

        <div className={cn("p-4 sm:p-5 space-y-6 transition-opacity", !cfg.enabled && "opacity-50 pointer-events-none")}>
          {/* Trigger Hour */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 gradient-primary rounded-md flex items-center justify-center">
                <Clock size={12} className="text-primary-foreground" />
              </div>
              <Label className="text-foreground font-semibold text-sm">自動返信発動時間</Label>
            </div>
            <p className="text-muted-foreground text-xs">未返信が指定時間を超えたときに自動返信します</p>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={11}
                value={cfg.triggerHour}
                onChange={e => updateConfig("triggerHour", Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-primary">{cfg.triggerHour}</span>
                <span className="text-sm text-muted-foreground ml-1">時間</span>
              </div>
            </div>

            <div className="flex justify-between text-xs text-muted-foreground px-0.5">
              <span>1h</span>
              <span>6h</span>
              <span>11h</span>
            </div>
          </div>

          {/* Order Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 gradient-primary rounded-md flex items-center justify-center">
                <Zap size={12} className="text-primary-foreground" />
              </div>
              <Label className="text-foreground font-semibold text-sm">注文ステータス連動</Label>
            </div>
            <p className="text-muted-foreground text-xs">選択したステータスの注文のみ自動返信します</p>

            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map(status => {
                const selected = cfg.statuses.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={cn(
                      "px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all border min-h-[40px] sm:min-h-0",
                      selected
                        ? "gradient-primary text-primary-foreground border-transparent shadow-purple"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 gradient-primary rounded-md flex items-center justify-center">
                <ChevronRight size={12} className="text-primary-foreground" />
              </div>
              <Label className="text-foreground font-semibold text-sm">使用テンプレート</Label>
            </div>

            <select
              value={cfg.template}
              onChange={e => updateConfig("template", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option>営業時間外の自動返信</option>
              <option>発送準備中のご案内</option>
              <option>追跡番号のご案内</option>
              <option>受取確認のお願い</option>
            </select>
          </div>

          {/* Info Box */}
          <div className="flex gap-2 p-3 bg-primary-subtle border border-primary/20 rounded-lg text-sm">
            <Info size={15} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-primary text-xs leading-relaxed">
              自動返信が発動した場合、担当者に通知されます。自動送信後も手動返信は可能です。
            </p>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold shadow-green hover:shadow-green-lg transition-all hover:opacity-90">
              設定を保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


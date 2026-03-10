"use client";

import { useState } from "react";
import { Zap, Clock, Globe, ChevronRight, Info, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const COUNTRIES = ["SG", "PH", "MY", "TW", "TH", "VN", "BR"];
const ORDER_STATUSES = ["注文受付", "発送準備中", "発送済み", "配達中", "配達完了", "キャンセル"];

type CountryConfig = {
  enabled: boolean;
  triggerHour: number;
  statuses: string[];
  template: string;
  subAccounts?: { id: string; name: string; enabled: boolean }[];
};

const defaultConfig: CountryConfig = {
  enabled: false,
  triggerHour: 3,
  statuses: ["注文受付"],
  template: "営業時間外の自動返信",
  subAccounts: [],
};

export default function AutoReplyPage() {
  const [configs, setConfigs] = useState<Record<string, CountryConfig>>(
    Object.fromEntries(COUNTRIES.map(c => [c, {
      ...defaultConfig,
      enabled: c === "SG" || c === "MY",
      triggerHour: c === "SG" ? 2 : c === "MY" ? 4 : 3,
      subAccounts: c === "SG" ? [
        { id: "sub1", name: "サブアカウント1", enabled: true },
        { id: "sub2", name: "サブアカウント2", enabled: false },
      ] : [],
    }]))
  );
  const [selectedCountry, setSelectedCountry] = useState("SG");
  const [showSubAccounts, setShowSubAccounts] = useState(false);

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

  const toggleSubAccount = (subId: string) => {
    const updated = cfg.subAccounts?.map(sub => 
      sub.id === subId ? { ...sub, enabled: !sub.enabled } : sub
    );
    updateConfig("subAccounts", updated);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl w-full min-w-0">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-foreground font-bold text-lg">自動返信設定</h2>
        <p className="text-muted-foreground text-sm mt-0.5">国別に自動返信の条件と内容を設定します</p>
      </div>

      {/* Country Selector - 横並び7か国表示 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-7 gap-3">
          {COUNTRIES.map(country => {
            const c = configs[country];
            return (
              <button
                key={country}
                onClick={() => setSelectedCountry(country)}
                className={cn(
                  "relative rounded-xl p-4 border-2 transition-all min-h-[80px] flex flex-col items-center justify-center",
                  selectedCountry === country
                    ? "bg-primary border-primary shadow-md"
                    : "bg-white border-gray-200 hover:border-primary/50"
                )}
              >
                <p className={cn(
                  "font-bold text-lg mb-2",
                  selectedCountry === country ? "text-white" : "text-gray-900"
                )}>{country}</p>
                <div className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  selectedCountry === country ? "text-white/90" : "text-gray-600"
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    c.enabled 
                      ? selectedCountry === country ? "bg-white" : "bg-success" 
                      : "bg-gray-400"
                  )} />
                  <span>{c.enabled ? "ON" : "OFF"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Config Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
        {/* Panel Header */}
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
                onCheckedChange={v => updateConfig("enabled", v)}
              />
            </div>
          </div>
        </div>

        {/* Sub Accounts Section */}
        {cfg.subAccounts && cfg.subAccounts.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50">
            <button
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
                {cfg.subAccounts.map(sub => (
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

        <div className={cn("p-5 space-y-6 transition-opacity", !cfg.enabled && "opacity-50 pointer-events-none")}>
          {/* Trigger Hour */}
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
                onChange={e => updateConfig("triggerHour", Number(e.target.value))}
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

          {/* Order Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <Zap size={16} className="text-primary" />
              </div>
              <Label className="text-gray-900 font-semibold text-sm">注文ステータス連動</Label>
            </div>
            <p className="text-gray-600 text-xs">選択したステータスの注文のみ自動返信します</p>

            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map(status => {
                const selected = cfg.statuses.includes(status);
                return (
                  <button
                    key={status}
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

          {/* Template */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <ChevronRight size={16} className="text-primary" />
              </div>
              <Label className="text-gray-900 font-semibold text-sm">使用テンプレート</Label>
            </div>

            <select
              value={cfg.template}
              onChange={e => updateConfig("template", e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option>営業時間外の自動返信</option>
              <option>発送準備中のご案内</option>
              <option>追跡番号のご案内</option>
              <option>受取確認のお願い</option>
            </select>
          </div>

          {/* Info Box */}
          <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
            <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-900 text-xs leading-relaxed">
              自動返信が発動した場合、担当者に通知されます。自動送信後も手動返信は可能です。
            </p>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <button className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all hover:opacity-90">
              設定を保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


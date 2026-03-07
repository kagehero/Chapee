"use client";

import { useState } from "react";
import {
  Plus, Edit2, Trash2, FileText, Check, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TW", "TH", "ID", "VN", "BR"];
const CATEGORIES = ["全て", "発送前", "配達後", "返品・交換", "一般対応", "自動返信"];

const mockTemplates = [
  { id: 1, country: "全て", category: "発送前", name: "発送準備中のご案内", content: "この度はご注文いただきありがとうございます。現在、ご注文商品の発送準備を進めております。出荷後、追跡番号をお知らせいたします。", autoReply: true, langs: ["JA", "EN"] },
  { id: 2, country: "SG", category: "発送前", name: "追跡番号のご案内", content: "ご注文の商品が発送されました。追跡番号：[TRACKING_NUMBER] にてご確認いただけます。", autoReply: false, langs: ["EN"] },
  { id: 3, country: "全て", category: "配達後", name: "受取確認のお願い", content: "商品はお受け取りいただけましたでしょうか？問題がございましたら、お気軽にご連絡ください。", autoReply: false, langs: ["JA", "EN", "ZH"] },
  { id: 4, country: "MY", category: "配達後", name: "レビューのお願い", content: "この度はお買い上げいただきありがとうございます。商品はいかがでしたでしょうか？ぜひレビューをお寄せください。", autoReply: false, langs: ["EN", "MS"] },
  { id: 5, country: "全て", category: "返品・交換", name: "返品対応案内", content: "ご不便をおかけして申し訳ございません。返品・交換は注文日から14日以内に承っております。", autoReply: false, langs: ["JA", "EN"] },
  { id: 6, country: "全て", category: "自動返信", name: "営業時間外の自動返信", content: "お問い合わせありがとうございます。現在、営業時間外です。翌営業日（9:00〜18:00）にご対応いたします。", autoReply: true, langs: ["JA", "EN"] },
];

const langColors: Record<string, string> = {
  JA: "bg-primary-subtle text-primary border-primary/20",
  EN: "bg-success/10 text-success border-success/20",
  ZH: "bg-warning/10 text-warning border-warning/20",
  MS: "bg-blue-50 text-blue-600 border-blue-200",
};

export default function TemplatesPage() {
  const [selectedCountry, setSelectedCountry] = useState("全て");
  const [selectedCategory, setSelectedCategory] = useState("全て");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [templates, setTemplates] = useState(mockTemplates);
  const [editContent, setEditContent] = useState("");

  const filtered = templates.filter(t => {
    const matchCountry = selectedCountry === "全て" || t.country === "全て" || t.country === selectedCountry;
    const matchCat = selectedCategory === "全て" || t.category === selectedCategory;
    return matchCountry && matchCat;
  });

  const startEdit = (t: typeof mockTemplates[0]) => {
    setEditingId(t.id);
    setEditContent(t.content);
  };

  const saveEdit = (id: number) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, content: editContent } : t));
    setEditingId(null);
  };

  const deleteTemplate = (id: number) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-foreground font-bold text-base sm:text-lg">テンプレート管理</h2>
          <p className="text-muted-foreground text-sm mt-0.5">国別・カテゴリ別に返信テンプレートを管理</p>
        </div>
        <Button className="gradient-primary text-primary-foreground shadow-green gap-1.5 w-full sm:w-auto min-h-[44px] sm:min-h-0">
          <Plus size={15} />
          新規追加
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-card overflow-x-auto min-h-[44px]">
          {COUNTRIES.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCountry(c)}
              className={cn(
                "px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[36px] sm:min-h-0",
                selectedCountry === c
                  ? "gradient-primary text-primary-foreground shadow-green"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-card overflow-x-auto min-h-[44px]">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={cn(
                "px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[36px] sm:min-h-0",
                selectedCategory === c
                  ? "gradient-primary text-primary-foreground shadow-green"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {filtered.map(t => (
          <div key={t.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden min-w-0">
            {/* Card Header */}
            <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-6 h-6 gradient-primary rounded-md flex items-center justify-center flex-shrink-0">
                  <FileText size={12} className="text-primary-foreground" />
                </div>
                <span className="text-foreground font-semibold text-sm">{t.name}</span>
                {t.autoReply && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-warning/15 text-warning border border-warning/30 rounded-full font-medium">
                    <Star size={9} />自動返信
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(t)}
                  className="p-1.5 rounded-lg hover:bg-primary-subtle text-muted-foreground hover:text-primary transition-all"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 gradient-primary text-primary-foreground rounded-full font-medium">
                  {t.country === "全て" ? "🌐 全国共通" : `🏳️ ${t.country}`}
                </span>
                <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full">
                  {t.category}
                </span>
                {t.langs.map(l => (
                  <span key={l} className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", langColors[l] || "bg-muted text-muted-foreground")}>
                    {l}
                  </span>
                ))}
              </div>

              {editingId === t.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="text-sm resize-none min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="gradient-primary text-primary-foreground gap-1" onClick={() => saveEdit(t.id)}>
                      <Check size={12} /> 保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>キャンセル</Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">{t.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Clock, AlertTriangle, AlertCircle,
  User, ChevronRight, Search, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TH", "ID", "VN"];

const mockChats = [
  { id: 1, country: "SG", customer: "Lee Wei Ming", product: "USB-C Hub 7-in-1", lastMessage: "商品はいつ届きますか？", time: "14:32", elapsed: 11.5, staff: "田中", status: "urgent" },
  { id: 2, country: "PH", customer: "Maria Santos", product: "Wireless Earbuds Pro", lastMessage: "配達状況を確認したいです", time: "13:15", elapsed: 9.2, staff: "佐藤", status: "warning" },
  { id: 3, country: "MY", customer: "Ahmad Farid", product: "Gaming Mouse X1", lastMessage: "返品したいです", time: "12:45", elapsed: 12.1, staff: "未割当", status: "critical" },
  { id: 4, country: "SG", customer: "Jenny Tan", product: "Laptop Stand Pro", lastMessage: "注文をキャンセルしたい", time: "11:20", elapsed: 8.5, staff: "山田", status: "normal" },
  { id: 5, country: "TH", customer: "Somchai K.", product: "Mechanical Keyboard", lastMessage: "色違いに変更できますか？", time: "10:55", elapsed: 13.2, staff: "未割当", status: "critical" },
  { id: 6, country: "ID", customer: "Budi Santoso", product: "Smart Watch Series 5", lastMessage: "故障しています", time: "16:10", elapsed: 6.3, staff: "鈴木", status: "normal" },
  { id: 7, country: "VN", customer: "Nguyen Van A", product: "Phone Case Bundle", lastMessage: "追跡番号を教えてください", time: "15:45", elapsed: 7.8, staff: "田中", status: "normal" },
  { id: 8, country: "MY", customer: "Lim Chee Keong", product: "Portable Charger 20000mAh", lastMessage: "領収書が必要です", time: "09:30", elapsed: 10.3, staff: "佐藤", status: "warning" },
];

const statusColors = {
  normal: "text-success bg-success/10 border-success/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  urgent: "text-orange-500 bg-orange-50 border-orange-200",
  critical: "text-destructive bg-destructive/10 border-destructive/20",
};

const statusLabel = (elapsed: number) => {
  if (elapsed >= 12) return { label: "12時間超", color: "critical" };
  if (elapsed >= 11) return { label: "11時間超", color: "urgent" };
  if (elapsed >= 10) return { label: "10時間超", color: "warning" };
  return { label: `${elapsed.toFixed(1)}h`, color: "normal" };
};

export default function DashboardPage() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState("全て");
  const [search, setSearch] = useState("");

  const filtered = mockChats.filter(c => {
    const matchCountry = selectedCountry === "全て" || c.country === selectedCountry;
    const matchSearch = c.customer.toLowerCase().includes(search.toLowerCase()) ||
      c.product.toLowerCase().includes(search.toLowerCase());
    return matchCountry && matchSearch;
  });

  const stats = [
    { label: "未返信", value: mockChats.length, icon: MessageSquare, color: "text-primary", bg: "bg-primary-subtle border-primary/20" },
    { label: "10時間超", value: mockChats.filter(c => c.elapsed >= 10).length, icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
    { label: "11時間超", value: mockChats.filter(c => c.elapsed >= 11).length, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
    { label: "12時間超", value: mockChats.filter(c => c.elapsed >= 12).length, icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={cn("rounded-xl p-3 sm:p-4 border flex items-center gap-3 sm:gap-4 shadow-card bg-card min-w-0", bg)}>
            <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center gradient-primary flex-shrink-0")}>
              <Icon size={18} className="text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium truncate">{label}</p>
              <p className={cn("text-xl sm:text-2xl font-bold truncate", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Country Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-card overflow-x-auto scrollbar-thin min-h-[44px]">
          {COUNTRIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCountry(c)}
              className={cn(
                "px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-[36px] sm:min-h-0",
                selectedCountry === c
                  ? "gradient-primary text-primary-foreground shadow-purple"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="顧客名・商品名で検索"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <RefreshCw size={13} />
            更新
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-foreground font-semibold text-sm">チャット一覧</p>
          <p className="text-muted-foreground text-xs">{filtered.length}件</p>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-muted-foreground text-sm px-4">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              未返信チャットはありません
            </div>
          ) : (
            filtered.map((chat) => {
              const s = statusLabel(chat.elapsed);
              return (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/chats/${chat.id}`)}
                  className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 hover:bg-primary-subtle/50 active:bg-primary-subtle/70 cursor-pointer transition-colors group min-h-[72px] sm:min-h-0"
                >
                  {/* Country Badge */}
                  <div className="flex-shrink-0 w-9 h-9 gradient-primary rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-primary-foreground text-xs font-bold">{chat.country}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-foreground font-semibold text-sm">{chat.customer}</span>
                      <span className="text-muted-foreground text-xs truncate hidden sm:block">— {chat.product}</span>
                    </div>
                    <p className="text-muted-foreground text-xs truncate">{chat.lastMessage}</p>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-muted-foreground text-xs">{chat.time}</span>
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full border",
                      statusColors[s.color as keyof typeof statusColors]
                    )}>
                      {s.label}
                    </span>
                  </div>

                  {/* Staff */}
                  <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 min-w-[72px]">
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                      <User size={11} className="text-primary-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">{chat.staff}</span>
                  </div>

                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


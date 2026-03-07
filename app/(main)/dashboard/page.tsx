"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Clock, AlertTriangle, AlertCircle,
  User, ChevronRight, Search, RefreshCw, Loader2, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TW", "TH", "ID", "VN", "BR"];

const mockChats = [
  { id: 1, country: "SG", customer: "Lee Wei Ming", product: "USB-C Hub 7-in-1", lastMessage: "商品はいつ届きますか？", time: "14:32", elapsed: 11.5, staff: "田中", status: "urgent", unread: 2 },
  { id: 2, country: "PH", customer: "Maria Santos", product: "Wireless Earbuds Pro", lastMessage: "配達状況を確認したいです", time: "13:15", elapsed: 9.2, staff: "佐藤", status: "warning", unread: 0 },
  { id: 3, country: "MY", customer: "Ahmad Farid", product: "Gaming Mouse X1", lastMessage: "返品したいです", time: "12:45", elapsed: 12.1, staff: "未割当", status: "critical", unread: 3 },
  { id: 4, country: "SG", customer: "Jenny Tan", product: "Laptop Stand Pro", lastMessage: "注文をキャンセルしたい", time: "11:20", elapsed: 8.5, staff: "山田", status: "normal", unread: 0 },
  { id: 5, country: "TH", customer: "Somchai K.", product: "Mechanical Keyboard", lastMessage: "色違いに変更できますか？", time: "10:55", elapsed: 13.2, staff: "未割当", status: "critical", unread: 1 },
  { id: 6, country: "ID", customer: "Budi Santoso", product: "Smart Watch Series 5", lastMessage: "故障しています", time: "16:10", elapsed: 6.3, staff: "鈴木", status: "normal", unread: 0 },
  { id: 7, country: "VN", customer: "Nguyen Van A", product: "Phone Case Bundle", lastMessage: "追跡番号を教えてください", time: "15:45", elapsed: 7.8, staff: "田中", status: "normal", unread: 0 },
  { id: 8, country: "MY", customer: "Lim Chee Keong", product: "Portable Charger 20000mAh", lastMessage: "領収書が必要です", time: "09:30", elapsed: 10.3, staff: "佐藤", status: "warning", unread: 1 },
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
  const [loading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    // Simulate sync delay
    setTimeout(() => {
      setSyncing(false);
    }, 1500);
  };

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
    <div className="space-y-5 animate-fade-in">
      {/* Modern Stats Row with Different Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }, index) => (
          <div 
            key={label} 
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 group"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bg)}>
                  <Icon size={22} className={color} />
                </div>
                <div className="text-right">
                  <p className={cn("text-3xl font-bold", color)}>{value}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm font-medium">{label}</p>
            </div>
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      {/* Country Tabs + Search with Modern Design */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white rounded-2xl p-2 shadow-sm border border-gray-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          {COUNTRIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCountry(c)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                selectedCountry === c
                  ? "bg-primary text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="顧客名・メッセージで検索"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 text-sm h-10 border-0 bg-gray-50 focus:bg-white rounded-xl"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-10 gap-2 rounded-xl border-gray-200 hover:bg-gray-50"
          >
            {syncing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span className="hidden sm:inline">同期中</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span className="hidden sm:inline">更新</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Chat List with Modern Card Design */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare size={16} className="text-primary" />
            </div>
            <p className="text-gray-900 font-bold text-base">チャット一覧</p>
          </div>
          <p className="text-gray-500 text-sm font-medium">{filtered.length}件</p>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="animate-spin text-primary mx-auto mb-3" size={36} />
              <p className="text-gray-500 text-sm">読み込み中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm px-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                <MessageSquare size={32} className="text-gray-300" />
              </div>
              {mockChats.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-gray-900 font-semibold">チャットがありません</p>
                  <p className="text-gray-500 text-xs mb-4">「更新」ボタンでShopeeから会話を同期してください</p>
                  <Link href="/settings">
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200">
                      <Settings size={16} />
                      設定でストアを接続
                    </Button>
                  </Link>
                </div>
              ) : (
                "検索結果がありません"
              )}
            </div>
          ) : (
            filtered.map((chat, index) => {
              const s = statusLabel(chat.elapsed);
              return (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/chats/${chat.id}`)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-all group"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Country Badge with Modern Design */}
                  <div className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-bold">{chat.country}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">{chat.customer}</span>
                      {chat.unread > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-semibold">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs truncate">{chat.lastMessage}</p>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-gray-400 text-xs font-medium">{chat.time}</span>
                    <span className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-full border",
                      statusColors[s.color as keyof typeof statusColors]
                    )}>
                      {s.label}
                    </span>
                  </div>

                  {/* Staff */}
                  <div className="hidden md:flex items-center gap-2 flex-shrink-0 min-w-[90px]">
                    <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
                      <User size={14} className="text-gray-600" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">{chat.staff || "未割当"}</span>
                  </div>

                  <ChevronRight size={18} className="text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


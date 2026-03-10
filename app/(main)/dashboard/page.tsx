"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Clock, AlertTriangle, AlertCircle,
  User, ChevronRight, Search, RefreshCw, Loader2, Settings,
  ShoppingCart, Bell, TrendingUp, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TW", "TH", "VN", "BR"];

// チャットタイプ定義
type ChatType = "buyer" | "notification" | "affiliate";

const mockChats = [
  { id: 1, country: "SG", customer: "Lee Wei Ming", product: "USB-C Hub 7-in-1", lastMessage: "商品はいつ届きますか？", time: "14:32", elapsed: 11.5, staff: "田中", status: "urgent", unread: 2, type: "buyer" as ChatType },
  { id: 2, country: "PH", customer: "Shopee通知", product: "返品リクエスト", lastMessage: "返品リクエストが届きました", time: "13:15", elapsed: 9.2, staff: "佐藤", status: "warning", unread: 1, type: "notification" as ChatType },
  { id: 3, country: "MY", customer: "Ahmad Farid", product: "Gaming Mouse X1", lastMessage: "返品したいです", time: "12:45", elapsed: 12.1, staff: "未割当", status: "critical", unread: 3, type: "buyer" as ChatType },
  { id: 4, country: "SG", customer: "Shopee通知", product: "キャンセルリクエスト", lastMessage: "キャンセルリクエストが届きました", time: "11:20", elapsed: 8.5, staff: "山田", status: "normal", unread: 1, type: "notification" as ChatType },
  { id: 5, country: "TH", customer: "Somchai K.", product: "Mechanical Keyboard", lastMessage: "色違いに変更できますか？", time: "10:55", elapsed: 13.2, staff: "未割当", status: "critical", unread: 1, type: "buyer" as ChatType },
  { id: 6, country: "VN", customer: "アフィリエイター", product: "商品プロモーション", lastMessage: "新商品のアフィリエイトについて", time: "16:10", elapsed: 6.3, staff: "鈴木", status: "normal", unread: 0, type: "affiliate" as ChatType },
  { id: 7, country: "VN", customer: "Nguyen Van A", product: "Phone Case Bundle", lastMessage: "追跡番号を教えてください", time: "15:45", elapsed: 7.8, staff: "田中", status: "normal", unread: 0, type: "buyer" as ChatType },
  { id: 8, country: "MY", customer: "Shopee通知", product: "配達完了通知", lastMessage: "商品が配達されました", time: "09:30", elapsed: 10.3, staff: "佐藤", status: "warning", unread: 0, type: "notification" as ChatType },
];

const statusColors = {
  normal: "text-success bg-success/10 border-success/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  urgent: "text-orange-500 bg-orange-50 border-orange-200",
  critical: "text-destructive bg-destructive/10 border-destructive/20",
};

const chatTypeConfig = {
  buyer: { 
    label: "バイヤー", 
    icon: ShoppingCart, 
    color: "text-blue-600", 
    bg: "bg-blue-50",
    description: "通常のバイヤーからのチャット"
  },
  notification: { 
    label: "通知", 
    icon: Bell, 
    color: "text-amber-600", 
    bg: "bg-amber-50",
    description: "Shopeeからの各種通知"
  },
  affiliate: { 
    label: "アフィリエイト", 
    icon: TrendingUp, 
    color: "text-purple-600", 
    bg: "bg-purple-50",
    description: "アフィリエイターからのチャット"
  },
};

const statusLabel = (elapsed: number) => {
  if (elapsed >= 12) return { label: "12時間超", color: "critical" };
  if (elapsed >= 11) return { label: "11時間超", color: "urgent" };
  if (elapsed >= 10) return { label: "10時間超", color: "warning" };
  return { label: `${elapsed.toFixed(1)}h`, color: "normal" };
};

type Chat = {
  id: string;
  shop_id: number;
  country: string;
  customer: string;
  customer_id: number;
  lastMessage: string;
  time: string;
  elapsed: number;
  staff?: string;
  unread: number;
  pinned: boolean;
  status: string;
  type?: ChatType;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/chats");
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      
      // Add type to chats (for now, default to "buyer" - can be enhanced later)
      const chatsWithType = (data.chats || []).map((chat: Chat) => ({
        ...chat,
        type: chat.type || ("buyer" as ChatType)
      }));
      
      setChats(chatsWithType);
    } catch (error) {
      console.error("Load chats error:", error);
      toast.error("チャットの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/shopee/sync", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "同期に失敗しました");
      }
      
      toast.success("会話を同期しました");
      // Reload chats after sync
      await loadChats();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(error instanceof Error ? error.message : "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  // チャットタイプ別の統計
  const buyerChats = chats.filter(c => c.type === "buyer");
  const notificationChats = chats.filter(c => c.type === "notification");
  const affiliateChats = chats.filter(c => c.type === "affiliate");

  const stats = [
    { label: "バイヤーチャット", value: buyerChats.length, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    { label: "Shopee通知", value: notificationChats.length, icon: Bell, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { label: "アフィリエイト", value: affiliateChats.length, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
    { label: "未返信合計", value: chats.filter(c => c.unread > 0).length, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ページタイトル */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">全体状況の概要を確認</p>
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
              同期中
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              データ更新
            </>
          )}
        </Button>
      </div>

      {/* チャットタイプ別統計カード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }, index) => (
          <div 
            key={label} 
            className="relative overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => {
              // ダッシュボードからはチャット管理ページに遷移
              if (label === "バイヤーチャット") router.push("/chats?type=buyer");
              else if (label === "Shopee通知") router.push("/chats?type=notification");
              else if (label === "アフィリエイト") router.push("/chats?type=affiliate");
              else router.push("/chats");
            }}
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
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      {/* 国別の状況サマリー */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-gray-600" />
            <h2 className="text-gray-900 font-bold text-base">国別サマリー</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {COUNTRIES.filter(c => c !== "全て").map((country) => {
            const countryChats = chats.filter(c => c.country === country);
            const unreadCount = countryChats.filter(c => c.unread > 0).length;
            return (
              <button
                key={country}
                onClick={() => router.push(`/chats?country=${country}`)}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <span className="text-white text-xs font-bold">{country}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{countryChats.length}</p>
                  <p className="text-xs text-gray-500 mt-1">チャット</p>
                  {unreadCount > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span className="text-xs font-semibold text-red-600">{unreadCount}件未読</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 最近のチャット（簡易表示） */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock size={16} className="text-primary" />
            </div>
            <p className="text-gray-900 font-bold text-base">最近のチャット</p>
          </div>
          <Link href="/chats">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200">
              すべて見る
              <ChevronRight size={14} />
            </Button>
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="animate-spin text-primary mx-auto mb-3" size={36} />
              <p className="text-gray-500 text-sm">読み込み中...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm px-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                <MessageSquare size={32} className="text-gray-300" />
              </div>
              <div className="space-y-3">
                <p className="text-gray-900 font-semibold">チャットがありません</p>
                <p className="text-gray-500 text-xs mb-4">「データ更新」ボタンでShopeeから会話を同期してください</p>
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200">
                    <Settings size={16} />
                    設定でストアを接続
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            // 最新5件のみ表示（ダッシュボードは概要）
            chats.slice(0, 5).map((chat, index) => {
              const typeConfig = chatTypeConfig[chat.type || "buyer"];
              const TypeIcon = typeConfig.icon;
              return (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/chats/${chat.id}`)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-all group"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Country Badge */}
                  <div className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-bold">{chat.country}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">{chat.customer}</span>
                      {/* チャットタイプバッジ */}
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                        typeConfig.bg, typeConfig.color
                      )}>
                        <TypeIcon size={12} />
                        <span>{typeConfig.label}</span>
                      </div>
                      {chat.unread > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-semibold">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs truncate">{chat.lastMessage}</p>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-400 text-xs font-medium">{chat.time}</span>
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


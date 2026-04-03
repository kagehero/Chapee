"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Clock, AlertCircle,
  ChevronRight, RefreshCw, Loader2, Settings,
  ShoppingCart, Bell, TrendingUp, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TW", "TH", "VN", "BR"];

// チャットタイプ定義
type ChatType = "buyer" | "notification" | "affiliate";


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

type SyncStatus = "idle" | "syncing" | "success" | "error";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  /** User clicked「データ更新」 */
  const [manualSyncing, setManualSyncing] = useState(false);
  /** POST /api/shopee/sync running in background after first paint */
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  /** Misconfigured redirect (e.g. Google): user pastes ?code=&shop_id= onto this page */
  const oauthRecoveryRef = useRef(false);

  // Shopee OAuth: callback redirects to /dashboard?shopee_connected=… or ?shopee_error=…
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("shopee_connected");
    const err = params.get("shopee_error");
    if (connected !== "true" && !err) return;

    if (connected === "true") {
      toast.success("Shopeeアカウントを接続しました");
    } else if (err) {
      toast.error(decodeURIComponent(err));
    }
    router.replace("/dashboard", { scroll: false });
  }, [router]);

  const fetchChats = useCallback(async () => {
    const res = await fetch("/api/chats");
    if (!res.ok) throw new Error("Failed to load chats");
    const data = await res.json();
    return (data.chats || []).map((chat: Chat) => ({
      ...chat,
      type: chat.type || ("buyer" as ChatType),
    }));
  }, []);

  const runBackgroundSync = useCallback(async () => {
    if (backgroundSyncInFlightRef.current) return;
    backgroundSyncInFlightRef.current = true;
    setBackgroundSyncing(true);
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const res = await fetch("/api/shopee/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "同期失敗");
      setSyncStatus("success");
      setLastSynced(new Date());
      setChats(await fetchChats());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "同期に失敗しました";
      setSyncStatus("error");
      setSyncError(msg);
    } finally {
      setBackgroundSyncing(false);
      backgroundSyncInFlightRef.current = false;
    }
  }, [fetchChats]);

  // Redirect URL が Google 等のとき: アドレスバーの code / shop_id を付けて /dashboard を開いた場合の救済
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const shopId = params.get("shop_id");
    if (!code || !shopId) return;
    if (params.get("shopee_connected") === "true" || params.get("shopee_error"))
      return;
    if (oauthRecoveryRef.current) return;
    oauthRecoveryRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/shopee/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            shop_id: shopId,
            country: "SG",
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "接続に失敗しました");
        }
        toast.success("Shopeeアカウントを接続しました");
        router.replace("/dashboard", { scroll: false });
        await runBackgroundSync();
      } catch (e) {
        oauthRecoveryRef.current = false;
        toast.error(e instanceof Error ? e.message : "接続に失敗しました");
        router.replace("/dashboard", { scroll: false });
      }
    })();
  }, [router, runBackgroundSync]);

  // 1) Load cached chats from MongoDB immediately. 2) Then sync from Shopee in the background
  // (does not block the first paint).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSyncStatus("idle");
      setSyncError(null);
      try {
        const list = await fetchChats();
        if (!cancelled) setChats(list);
      } catch {
        if (!cancelled) toast.error("チャットの読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (cancelled) return;
      void runBackgroundSync();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchChats, runBackgroundSync]);

  const handleSync = async () => {
    setManualSyncing(true);
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const res = await fetch("/api/shopee/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "同期に失敗しました");
      setSyncStatus("success");
      setLastSynced(new Date());
      toast.success("Shopeeから会話を同期しました");
      setChats(await fetchChats());
    } catch (error) {
      const msg = error instanceof Error ? error.message : "同期に失敗しました";
      setSyncStatus("error");
      setSyncError(msg);
      toast.error(msg);
    } finally {
      setManualSyncing(false);
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
          <div className="flex items-center gap-2 mt-1">
            {(syncStatus === "syncing" || backgroundSyncing || manualSyncing) && (
              <span className="flex items-center gap-1 text-xs text-blue-500">
                <Loader2 size={12} className="animate-spin" />
                {manualSyncing
                  ? "Shopeeから同期中..."
                  : "バックグラウンドでShopee同期中..."}
              </span>
            )}
            {syncStatus === "success" && lastSynced && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 size={12} />
                最終同期: {lastSynced.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {syncStatus === "error" && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <XCircle size={12} />
                {syncError ?? "同期エラー"}
              </span>
            )}
            {syncStatus === "idle" &&
              !backgroundSyncing &&
              !manualSyncing && (
              <p className="text-sm text-gray-500">全体状況の概要を確認</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={manualSyncing || loading}
          className="h-10 gap-2 rounded-xl border-gray-200 hover:bg-gray-50"
        >
          {manualSyncing ? (
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
              if (label === "Shopee通知") {
                router.push("/chats?focus=notifications");
                return;
              }
              if (label === "バイヤーチャット" || label === "アフィリエイト") {
                router.push("/chats");
                return;
              }
              router.push("/chats");
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
                  {/* Fixed height area for unread badge */}
                  <div className="mt-2 h-6 flex items-center justify-center">
                    {unreadCount > 0 ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        <span className="text-xs font-semibold text-red-600">{unreadCount}件未読</span>
                      </div>
                    ) : (
                      <div className="h-6"></div>
                    )}
                  </div>
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
                {syncStatus === "error"
                  ? <XCircle size={32} className="text-red-400" />
                  : <MessageSquare size={32} className="text-gray-300" />}
              </div>
              <div className="space-y-3">
                {syncStatus === "error" ? (
                  <>
                    <p className="text-gray-900 font-semibold">Shopee同期エラー</p>
                    <p className="text-gray-500 text-xs">{syncError}</p>
                    <Button variant="outline" size="sm" onClick={handleSync} className="gap-2 rounded-xl border-gray-200">
                      <RefreshCw size={16} />
                      再同期
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-gray-900 font-semibold">チャットがありません</p>
                    <p className="text-gray-500 text-xs mb-4">Shopeeストアを接続して会話を同期してください</p>
                    <Link href="/settings">
                      <Button variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200">
                        <Settings size={16} />
                        設定でストアを接続
                      </Button>
                    </Link>
                  </>
                )}
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


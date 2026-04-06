"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Users as UsersIcon,
  ChevronRight, User,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StaffSendKindPill, type LastStaffSendKind } from "@/components/StaffSendKindPill";
import {
  dispatchShopNotificationsRefresh,
  sumNewNotificationIdsFromSyncResults,
} from "@/lib/chapee-shop-notifications-events";
import { matchChatSearchQuery } from "@/lib/chat-search";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TW", "TH", "VN", "BR"];

type ChatStatus = "open" | "replied" | "closed";

type ChatRow = {
  id: string;
  country: string;
  customer: string;
  product: string;
  lastMessage: string;
  time: string;
  date: string;
  elapsed: number;
  staff: string;
  unread: number;
  uiStatus: ChatStatus;
  /** Chapee 経由で記録された直近の店舗送信 */
  last_staff_send_kind?: LastStaffSendKind | null;
};

const statusConfig = {
  open: { label: "未対応", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  replied: { label: "返信済", color: "text-blue-600 bg-blue-50 border-blue-200", icon: CheckCircle },
  closed: { label: "完了", color: "text-gray-600 bg-gray-50 border-gray-200", icon: XCircle },
};

export default function ChatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("全て");
  const [selectedStatus, setSelectedStatus] = useState<ChatStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const c = searchParams.get("country");
    if (c && COUNTRIES.includes(c)) setSelectedCountry(c);
    const u = searchParams.get("unread_only") ?? searchParams.get("unread");
    if (u === "1" || u === "true") setUnreadOnly(true);
  }, [searchParams]);

  const loadChats = useCallback(async () => {
    const res = await fetch(
      "/api/chats?exclude_chat_types=notification"
    );
    if (!res.ok) throw new Error("Failed to load chats");
    const data = await res.json();
    const rows: ChatRow[] = (data.chats || []).map(
      (c: {
        id: string;
        country: string;
        customer: string;
        lastMessage: string;
        time: string;
        elapsed: number;
        staff?: string;
        unread: number;
        uiStatus?: ChatStatus;
        product?: string;
        date?: string;
        last_staff_send_kind?: LastStaffSendKind | null;
      }) => ({
        id: String(c.id),
        country: c.country,
        customer: c.customer,
        product: c.product ?? "—",
        lastMessage: c.lastMessage,
        time: c.time,
        date: c.date ?? "",
        elapsed: c.elapsed,
        staff: c.staff ?? "未割当",
        unread: c.unread,
        uiStatus: (c.uiStatus as ChatStatus) || "replied",
        last_staff_send_kind: c.last_staff_send_kind ?? null,
      })
    );
    setChats(rows);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadChats();
      } catch (e) {
        console.error(e);
        toast.error("チャット一覧の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadChats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/shopee/sync", { method: "POST" });
      const data = (await res.json()) as {
        results?: Array<{
          error?: string;
          delta?: { new_notification_ids?: string[] };
        }>;
      };
      if (res.ok) {
        dispatchShopNotificationsRefresh({
          newNotificationIdsTotal: sumNewNotificationIdsFromSyncResults(
            data.results
          ),
        });
      }
      await loadChats();
      toast.success("同期しました");
    } catch (e) {
      toast.error("同期に失敗しました");
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = chats.filter((c) => {
    const matchCountry = selectedCountry === "全て" || c.country === selectedCountry;
    const matchStatus = selectedStatus === "all" || c.uiStatus === selectedStatus;
    const matchSearch = matchChatSearchQuery(search, c);
    const matchUnread = !unreadOnly || c.unread > 0;
    return matchCountry && matchStatus && matchSearch && matchUnread;
  });

  const totalUnreadMessages = chats.reduce((s, c) => s + (c.unread > 0 ? c.unread : 0), 0);
  const unreadConversationCount = chats.filter((c) => c.unread > 0).length;

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedChats = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedChats.length === paginatedChats.length) {
      setSelectedChats([]);
    } else {
      setSelectedChats(paginatedChats.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedChats((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = () => {
    if (selectedChats.length === 0) {
      alert("チャットを選択してください");
      return;
    }
    toast.info(`${selectedChats.length}件の一括割当は、担当者API連携後に有効にできます`);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-gray-900 font-bold text-lg">チャット管理</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            未読は一覧の先頭に表示されます。店舗側の最終送信が Chapee 経由の場合のみ「手動／テンプレ／自動返信」を表示します。
          </p>
          {unreadConversationCount > 0 && (
            <p className="text-sm font-semibold text-amber-800 mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-200 px-2.5 py-1">
                <AlertCircle size={14} />
                未読会話 {unreadConversationCount} 件 / 未読メッセージ合計 {totalUnreadMessages} 通
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="gap-2 rounded-xl"
          >
            {refreshing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Shopeeと同期
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkAssign}
            disabled={selectedChats.length === 0}
            className="gap-2 rounded-xl"
          >
            <UsersIcon size={16} />
            一括担当者割当
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="顧客名・商品名・メッセージ・アイテムIDで検索（スペース区切りで複数キーワード可）"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-gray-200"
          />
        </div>

        {/* Country Filter */}
        <div>
          <label className="text-gray-700 text-sm font-semibold mb-2 block">国</label>
          <div className="flex gap-2 flex-wrap">
            {COUNTRIES.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCountry(c)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                  selectedCountry === c
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Unread filter */}
        <div>
          <label className="text-gray-700 text-sm font-semibold mb-2 block">未読</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                !unreadOnly
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
              )}
            >
              すべて
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border flex items-center gap-1.5",
                unreadOnly
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-red-300"
              )}
            >
              <AlertCircle size={14} />
              未読のみ
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-gray-700 text-sm font-semibold mb-2 block">ステータス</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedStatus("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                selectedStatus === "all"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
              )}
            >
              全て
            </button>
            {(Object.entries(statusConfig) as [ChatStatus, typeof statusConfig[ChatStatus]][]).map(([status, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border flex items-center gap-1.5",
                    selectedStatus === status
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                  )}
                >
                  <Icon size={14} />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
        <span className="text-gray-600">
          表示 {filtered.length} 件 / 全 {chats.length} 件（{selectedChats.length} 件選択中）
        </span>
        <span className="text-gray-500">
          ページ {currentPage} / {totalPages}
        </span>
      </div>

      {/* Chat List Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedChats.length === paginatedChats.length && paginatedChats.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">国</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">未読</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">顧客名</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">店舗最終送信</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">商品</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">最終メッセージ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">日時</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">経過時間</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">ステータス</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">担当者</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-gray-500">
                    <Loader2 className="animate-spin inline-block mr-2" size={20} />
                    読み込み中...
                  </td>
                </tr>
              ) : (
              paginatedChats.map(chat => {
                const statusInfo = statusConfig[chat.uiStatus];
                const StatusIcon = statusInfo.icon;
                
                // 経過時間に応じた背景色を決定（未対応のみ）
                let rowBgColor = "";
                if (chat.uiStatus === "open" && chat.unread > 0) {
                  if (chat.elapsed >= 11) {
                    rowBgColor = "bg-red-50/50"; // 11時間以上: 赤
                  } else if (chat.elapsed >= 8) {
                    rowBgColor = "bg-orange-50/50"; // 8時間以上: オレンジ
                  }
                }
                
                return (
                  <tr 
                    key={chat.id}
                    className={cn(
                      "hover:bg-gray-50 cursor-pointer transition-colors",
                      rowBgColor,
                      chat.unread > 0 && "border-l-4 border-l-red-500 bg-red-50/30"
                    )}
                    onClick={() => router.push(`/chats/${chat.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedChats.includes(chat.id)}
                        onChange={() => toggleSelect(chat.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white text-xs font-bold">
                        {chat.country}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {chat.unread > 0 ? (
                        <span className="inline-flex min-w-[2rem] justify-center items-center rounded-full bg-red-600 text-white text-xs font-bold px-2 py-0.5 tabular-nums">
                          {chat.unread}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-900 font-medium text-sm">{chat.customer}</span>
                        {chat.unread > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            要対応
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StaffSendKindPill kind={chat.last_staff_send_kind} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{chat.product}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">{chat.lastMessage}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div className="flex flex-col">
                        <span>{chat.date}</span>
                        <span className="text-gray-400">{chat.time}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-900 font-medium text-sm">{chat.elapsed}h</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border", statusInfo.color)}>
                        <StatusIcon size={12} />
                        {statusInfo.label}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-gray-400" />
                        <span className="text-gray-700 text-sm">{chat.staff}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={16} className="text-gray-400" />
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-xl"
            >
              前へ
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                    currentPage === page
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl"
            >
              次へ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

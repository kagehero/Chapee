"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Search, Filter, Users as UsersIcon,
  ChevronRight, User, ShoppingCart, Bell, TrendingUp, Calendar,
  Clock, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COUNTRIES = ["全て", "SG", "PH", "MY", "TW", "TH", "VN", "BR"];

type ChatType = "buyer" | "notification" | "affiliate";
type ChatStatus = "open" | "replied" | "closed";

const mockChats = [
  { id: 1, country: "SG", customer: "Lee Wei Ming", product: "USB-C Hub 7-in-1", lastMessage: "商品はいつ届きますか？", time: "14:32", date: "2024-03-15", elapsed: 11.5, staff: "田中", status: "open" as ChatStatus, unread: 2, type: "buyer" as ChatType },
  { id: 2, country: "PH", customer: "Shopee通知", product: "返品リクエスト", lastMessage: "返品リクエストが届きました", time: "13:15", date: "2024-03-15", elapsed: 9.2, staff: "佐藤", status: "open" as ChatStatus, unread: 1, type: "notification" as ChatType },
  { id: 3, country: "MY", customer: "Ahmad Farid", product: "Gaming Mouse X1", lastMessage: "返品したいです", time: "12:45", date: "2024-03-15", elapsed: 12.1, staff: "未割当", status: "open" as ChatStatus, unread: 3, type: "buyer" as ChatType },
  { id: 4, country: "SG", customer: "Shopee通知", product: "キャンセルリクエスト", lastMessage: "キャンセルリクエストが届きました", time: "11:20", date: "2024-03-15", elapsed: 8.5, staff: "山田", status: "replied" as ChatStatus, unread: 0, type: "notification" as ChatType },
  { id: 5, country: "TH", customer: "Somchai K.", product: "Mechanical Keyboard", lastMessage: "色違いに変更できますか？", time: "10:55", date: "2024-03-15", elapsed: 13.2, staff: "未割当", status: "open" as ChatStatus, unread: 1, type: "buyer" as ChatType },
  { id: 6, country: "VN", customer: "アフィリエイター", product: "商品プロモーション", lastMessage: "新商品のアフィリエイトについて", time: "16:10", date: "2024-03-14", elapsed: 6.3, staff: "鈴木", status: "replied" as ChatStatus, unread: 0, type: "affiliate" as ChatType },
  { id: 7, country: "VN", customer: "Nguyen Van A", product: "Phone Case Bundle", lastMessage: "ありがとうございました", time: "15:45", date: "2024-03-14", elapsed: 7.8, staff: "田中", status: "closed" as ChatStatus, unread: 0, type: "buyer" as ChatType },
  { id: 8, country: "MY", customer: "Shopee通知", product: "配達完了通知", lastMessage: "商品が配達されました", time: "09:30", date: "2024-03-14", elapsed: 10.3, staff: "佐藤", status: "closed" as ChatStatus, unread: 0, type: "notification" as ChatType },
  { id: 9, country: "SG", customer: "Jessica Wong", product: "Bluetooth Speaker", lastMessage: "音質はどうですか？", time: "08:15", date: "2024-03-14", elapsed: 5.2, staff: "山田", status: "replied" as ChatStatus, unread: 0, type: "buyer" as ChatType },
  { id: 10, country: "PH", customer: "Carlos Santos", product: "Gaming Headset", lastMessage: "在庫はありますか？", time: "07:30", date: "2024-03-14", elapsed: 4.1, staff: "田中", status: "replied" as ChatStatus, unread: 0, type: "buyer" as ChatType },
];

const chatTypeConfig = {
  buyer: { 
    label: "バイヤー", 
    icon: ShoppingCart, 
    color: "text-blue-600", 
    bg: "bg-blue-50",
  },
  notification: { 
    label: "通知", 
    icon: Bell, 
    color: "text-amber-600", 
    bg: "bg-amber-50",
  },
  affiliate: { 
    label: "アフィリエイト", 
    icon: TrendingUp, 
    color: "text-purple-600", 
    bg: "bg-purple-50",
  },
};

const statusConfig = {
  open: { label: "未対応", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  replied: { label: "返信済", color: "text-blue-600 bg-blue-50 border-blue-200", icon: CheckCircle },
  closed: { label: "完了", color: "text-gray-600 bg-gray-50 border-gray-200", icon: XCircle },
};

export default function ChatsPage() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState("全て");
  const [selectedType, setSelectedType] = useState<ChatType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<ChatStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = mockChats.filter(c => {
    const matchCountry = selectedCountry === "全て" || c.country === selectedCountry;
    const matchType = selectedType === "all" || c.type === selectedType;
    const matchStatus = selectedStatus === "all" || c.status === selectedStatus;
    const matchSearch = c.customer.toLowerCase().includes(search.toLowerCase()) ||
      c.product.toLowerCase().includes(search.toLowerCase());
    return matchCountry && matchType && matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedChats = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedChats.length === paginatedChats.length) {
      setSelectedChats([]);
    } else {
      setSelectedChats(paginatedChats.map(c => c.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedChats(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = () => {
    if (selectedChats.length === 0) {
      alert("チャットを選択してください");
      return;
    }
    alert(`${selectedChats.length}件のチャットに担当者を一括割り当て（実装予定）`);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 font-bold text-lg">チャット管理</h2>
          <p className="text-gray-500 text-sm mt-0.5">全チャットの詳細管理と一括操作</p>
        </div>
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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="顧客名・商品名・メッセージで検索"
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

        {/* Type Filter */}
        <div>
          <label className="text-gray-700 text-sm font-semibold mb-2 block">チャットタイプ</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedType("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                selectedType === "all"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
              )}
            >
              全て
            </button>
            {(Object.entries(chatTypeConfig) as [ChatType, typeof chatTypeConfig[ChatType]][]).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border flex items-center gap-1.5",
                    selectedType === type
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
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {filtered.length}件のチャット（{selectedChats.length}件選択中）
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">タイプ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">顧客名</th>
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
              {paginatedChats.map(chat => {
                const typeConfig = chatTypeConfig[chat.type];
                const TypeIcon = typeConfig.icon;
                const statusInfo = statusConfig[chat.status];
                const StatusIcon = statusInfo.icon;
                
                // 経過時間に応じた背景色を決定（未対応のみ）
                let rowBgColor = "";
                if (chat.status === "open" && chat.unread > 0) {
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
                      rowBgColor
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
                      <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium", typeConfig.bg, typeConfig.color)}>
                        <TypeIcon size={12} />
                        {typeConfig.label}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium text-sm">{chat.customer}</span>
                        {chat.unread > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                            {chat.unread}
                          </span>
                        )}
                      </div>
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
              })}
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

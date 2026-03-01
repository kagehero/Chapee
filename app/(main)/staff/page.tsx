"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ROLES = ["管理者", "オペレーター", "閲覧者"];
const COUNTRIES = ["SG", "PH", "MY", "TH", "ID", "VN"];

const mockStaff = [
  { id: 1, name: "田中 太郎", email: "tanaka@company.jp", role: "管理者", countries: ["SG", "MY", "TH"], activeChats: 3, status: "online" },
  { id: 2, name: "佐藤 花子", email: "sato@company.jp", role: "オペレーター", countries: ["PH", "ID"], activeChats: 5, status: "online" },
  { id: 3, name: "山田 次郎", email: "yamada@company.jp", role: "オペレーター", countries: ["SG", "VN"], activeChats: 2, status: "away" },
  { id: 4, name: "鈴木 愛", email: "suzuki@company.jp", role: "オペレーター", countries: ["MY", "TH"], activeChats: 0, status: "offline" },
  { id: 5, name: "伊藤 健", email: "ito@company.jp", role: "閲覧者", countries: ["SG"], activeChats: 0, status: "offline" },
];

const roleColors: Record<string, string> = {
  "管理者": "gradient-primary text-primary-foreground",
  "オペレーター": "bg-success/15 text-success border-success/30 border",
  "閲覧者": "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};
const statusLabel: Record<string, string> = {
  online: "オンライン",
  away: "離席中",
  offline: "オフライン",
};

export default function StaffPage() {
  const [staff, setStaff] = useState(mockStaff);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("オペレーター");
  const [newCountries, setNewCountries] = useState<string[]>(["SG"]);

  const toggleCountry = (c: string) => {
    setNewCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addStaff = () => {
    if (!newName || !newEmail) return;
    setStaff(prev => [...prev, {
      id: Date.now(),
      name: newName,
      email: newEmail,
      role: newRole,
      countries: newCountries,
      activeChats: 0,
      status: "offline",
    }]);
    setShowAdd(false);
    setNewName(""); setNewEmail(""); setNewRole("オペレーター"); setNewCountries(["SG"]);
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-foreground font-bold text-base sm:text-lg">担当者管理</h2>
          <p className="text-muted-foreground text-sm mt-0.5">チームメンバーと権限を管理します</p>
        </div>
        <Button
          className="gradient-primary text-primary-foreground shadow-purple gap-1.5 w-full sm:w-auto min-h-[44px] sm:min-h-0"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={15} />
          担当者追加
        </Button>
      </div>

      {/* 新規担当者追加モーダル */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md border-border shadow-card">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <Plus size={14} className="text-primary-foreground" />
              </div>
              <DialogTitle className="text-base">新規担当者登録</DialogTitle>
            </div>
            <DialogDescription className="text-left text-xs">
              氏名・メール・権限・担当国を入力して登録します
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">氏名</label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="田中 太郎"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">メールアドレス</label>
                <Input
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="email@company.jp"
                  type="email"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">権限</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      newRole === r
                        ? "gradient-primary text-primary-foreground border-transparent shadow-purple"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/30"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">担当国</label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCountry(c)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
                      newCountries.includes(c)
                        ? "gradient-primary text-primary-foreground border-transparent shadow-purple"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/30"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
              キャンセル
            </Button>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground shadow-purple"
              onClick={addStaff}
            >
              登録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "総担当者数", value: staff.length },
          { label: "オンライン", value: staff.filter(s => s.status === "online").length },
          { label: "対応中チャット", value: staff.reduce((a, s) => a + s.activeChats, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card rounded-xl border border-border shadow-card p-3 sm:p-4 text-center min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-primary">{value}</p>
            <p className="text-muted-foreground text-xs mt-0.5 truncate">{label}</p>
          </div>
        ))}
      </div>

      {/* Staff Table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gradient-primary">
          <p className="text-primary-foreground font-semibold text-sm">チームメンバー</p>
          <p className="text-primary-foreground/70 text-xs">{staff.length}名</p>
        </div>
        <div className="divide-y divide-border">
          {staff.map(s => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 hover:bg-primary-subtle/30 transition-colors min-h-[72px] sm:min-h-0">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">{s.name[0]}</span>
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                  statusColors[s.status]
                )} />
              </div>

              {/* Name & Email */}
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold text-sm">{s.name}</p>
                <p className="text-muted-foreground text-xs">{s.email}</p>
              </div>

              {/* Role */}
              <div className="hidden sm:block">
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium", roleColors[s.role])}>
                  {s.role}
                </span>
              </div>

              {/* Countries */}
              <div className="hidden md:flex items-center gap-1 flex-wrap max-w-[120px]">
                {s.countries.map(c => (
                  <span key={c} className="text-xs px-1.5 py-0.5 bg-primary-subtle text-primary border border-primary/20 rounded font-medium">
                    {c}
                  </span>
                ))}
              </div>

              {/* Chats */}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground min-w-[64px]">
                <MessageSquare size={12} className="text-primary" />
                {s.activeChats}件対応中
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[64px]">
                <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[s.status])} />
                {statusLabel[s.status]}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button className="p-1.5 rounded-lg hover:bg-primary-subtle text-muted-foreground hover:text-primary transition-all">
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => setStaff(prev => prev.filter(x => x.id !== s.id))}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


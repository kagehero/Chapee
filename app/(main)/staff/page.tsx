"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, MessageSquare, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import {
  SHOPEE_MARKET_CODES,
  defaultStaffMarketCountries,
} from "@/lib/shopee-markets";

const ROLES = ["管理者", "オペレーター", "閲覧者"];
const COUNTRIES = [...SHOPEE_MARKET_CODES];

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  countries: string[];
  activeChats: number;
  status: "online" | "away" | "offline";
};

const roleColors: Record<string, string> = {
  管理者: "gradient-primary text-primary-foreground",
  オペレーター: "bg-success/15 text-success border-success/30 border",
  閲覧者: "bg-muted text-muted-foreground",
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
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("オペレーター");
  const [newCountries, setNewCountries] = useState<string[]>(
    defaultStaffMarketCountries()
  );

  const loadStaff = useCallback(async () => {
    const res = await fetch("/api/staff");
    if (!res.ok) throw new Error("load failed");
    const data = await res.json();
    setStaff(data.staff || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadStaff();
      } catch {
        toast.error("担当者一覧の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStaff]);

  const toggleCountry = (c: string) => {
    setNewCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const addStaff = async () => {
    if (!newName || !newEmail) return;
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
          countries: newCountries,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStaff((prev) => [...prev, data.staff]);
      setShowAdd(false);
      setNewName("");
      setNewEmail("");
      setNewRole("オペレーター");
      setNewCountries(defaultStaffMarketCountries());
      toast.success("担当者を登録しました");
    } catch {
      toast.error("登録に失敗しました");
    }
  };

  const removeStaff = async (id: string) => {
    try {
      const res = await fetch(`/api/staff?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setStaff((prev) => prev.filter((x) => x.id !== id));
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-foreground font-bold text-base sm:text-lg">担当者管理</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            MongoDB に保存（チーム共有）
          </p>
        </div>
        <Button
          className="gradient-primary text-primary-foreground shadow-green gap-1.5 w-full sm:w-auto min-h-[44px] sm:min-h-0"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={15} />
          担当者追加
        </Button>
      </div>

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
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="田中 太郎"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">メールアドレス</label>
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@company.jp"
                  type="email"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">権限</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      newRole === r
                        ? "gradient-primary text-primary-foreground border-transparent shadow-green"
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
                {COUNTRIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCountry(c)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
                      newCountries.includes(c)
                        ? "gradient-primary text-primary-foreground border-transparent shadow-green"
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
              className="gradient-primary text-primary-foreground shadow-green"
              onClick={addStaff}
            >
              登録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "総担当者数", value: staff.length },
          { label: "オンライン", value: staff.filter((s) => s.status === "online").length },
          {
            label: "対応中チャット",
            value: staff.reduce((a, s) => a + s.activeChats, 0),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-card rounded-xl border border-border shadow-card p-3 sm:p-4 text-center min-w-0"
          >
            <p className="text-xl sm:text-2xl font-bold text-primary">{value}</p>
            <p className="text-muted-foreground text-xs mt-0.5 truncate">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gradient-primary">
          <p className="text-primary-foreground font-semibold text-sm">チームメンバー</p>
          <p className="text-primary-foreground/70 text-xs">{staff.length}名</p>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">
              <Loader2 className="inline animate-spin mr-2" size={18} />
              読み込み中...
            </div>
          ) : staff.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">
              担当者がまだいません。「担当者追加」から登録してください。
            </div>
          ) : (
            staff.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 hover:bg-primary-subtle/30 transition-colors min-h-[72px] sm:min-h-0"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">{s.name[0]}</span>
                  </div>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                      statusColors[s.status]
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-semibold text-sm">{s.name}</p>
                  <p className="text-muted-foreground text-xs">{s.email}</p>
                </div>

                <div className="hidden sm:block">
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      roleColors[s.role]
                    )}
                  >
                    {s.role}
                  </span>
                </div>

                <div className="hidden md:flex items-center gap-1 flex-wrap max-w-[120px]">
                  {s.countries.map((c) => (
                    <span
                      key={c}
                      className="text-xs px-1.5 py-0.5 bg-primary-subtle text-primary border border-primary/20 rounded font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground min-w-[64px]">
                  <MessageSquare size={12} className="text-primary" />
                  {s.activeChats}件対応中
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[64px]">
                  <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[s.status])} />
                  {statusLabel[s.status]}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-primary-subtle text-muted-foreground hover:text-primary transition-all"
                    aria-label="編集（未実装）"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStaff(s.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    aria-label="削除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Store, CheckCircle2, RefreshCw, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getNotificationSoundsEnabled,
  setNotificationSoundsEnabled,
} from "@/lib/notification-sound-settings";

type ShopeeConnection = {
  shop_id: number;
  shop_name?: string;
  country: string;
  expires_at: string;
  updated_at: string;
};

const COUNTRIES = [
  { code: "SG", name: "Singapore" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "VN", name: "Vietnam" },
  { code: "BR", name: "Brazil" },
];

export default function SettingsPage() {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connections, setConnections] = useState<ShopeeConnection[]>([]);
  const [notificationSoundsOn, setNotificationSoundsOn] = useState(true);

  useEffect(() => {
    setNotificationSoundsOn(getNotificationSoundsEnabled());
  }, []);

  const handleNotificationSoundsChange = (checked: boolean) => {
    setNotificationSoundsEnabled(checked);
    setNotificationSoundsOn(checked);
    toast.success(checked ? "通知音をオンにしました" : "通知音をオフにしました");
  };

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/status");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const handleShopeeOAuth = async () => {
    setOauthLoading(true);
    try {
      const res = await fetch("/api/shopee/auth-url", {
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "認証URLの取得に失敗しました");
      }
      if (!data.url) {
        throw new Error("認証URLが無効です");
      }
      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "接続の準備に失敗しました"
      );
      setOauthLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/shopee/sync", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "同期に失敗しました");
      
      const totalSynced = data.results.reduce((sum: number, r: { synced?: number }) => sum + (r.synced || 0), 0);
      toast.success(`${totalSynced}件の会話を同期しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-foreground font-bold text-base sm:text-lg">設定</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Shopeeアカウント接続とシステム設定
        </p>
      </div>

      {/* Notification sounds */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell size={14} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">通知音</p>
            <p className="text-muted-foreground text-xs">
              新着メッセージ・売上などの通知音のON/OFF
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notification-sounds" className="text-sm cursor-pointer">
            通知音を鳴らす
          </Label>
          <Switch
            id="notification-sounds"
            checked={notificationSoundsOn}
            onCheckedChange={handleNotificationSoundsChange}
          />
        </div>
      </div>

      {/* Shopee Connection */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <Store size={14} className="text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">
              Shopeeアカウント接続
            </p>
            <p className="text-muted-foreground text-xs">
              ボタンからShopeeにログインし、権限を許可すると連携が完了します
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            type="button"
            onClick={handleShopeeOAuth}
            disabled={oauthLoading}
            className="gradient-primary text-primary-foreground shadow-green gap-2 w-full sm:w-auto"
          >
            {oauthLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                準備中...
              </>
            ) : (
              <>
                <Store size={14} />
                Shopeeアカウントを連携
              </>
            )}
          </Button>
          <p className="text-muted-foreground text-xs sm:max-w-md">
            Partner ID や認証コードの入力は不要です。連携後、下に接続済み店舗が表示されます。
          </p>
        </div>
      </div>

      {/* Connected Accounts */}
      {connections.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border gradient-primary flex items-center justify-between">
            <p className="text-primary-foreground font-semibold text-sm">
              接続済みアカウント ({connections.length}店舗)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncing}
              className="h-8 gap-1.5 text-primary-foreground hover:bg-primary-foreground/20"
            >
              {syncing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  同期中
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  全店舗同期
                </>
              )}
            </Button>
          </div>
          <div className="divide-y divide-border">
            {connections.map((conn) => {
              const countryInfo = COUNTRIES.find((c) => c.code === conn.country);
              return (
                <div
                  key={conn.shop_id}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary-subtle/30 transition-colors"
                >
                  <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <Store size={16} className="text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm">
                      {conn.shop_name || `${countryInfo?.name} Shop`}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {conn.country} • Shop ID: {conn.shop_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      size={16}
                      className="text-success flex-shrink-0"
                    />
                    <span className="text-xs text-success font-medium hidden sm:inline">
                      接続済み
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2">
        <p className="text-foreground font-semibold text-sm">連携の流れ</p>
        <ol className="text-muted-foreground text-xs space-y-1 list-decimal list-inside">
          <li>「Shopeeアカウントを連携」をクリック</li>
          <li>Shopeeの画面でログインし、アプリの連携を許可</li>
          <li>自動でこの画面に戻り、接続済みとして表示されます</li>
        </ol>
        <p className="text-muted-foreground text-xs pt-1 border-t border-border mt-2">
          運用側では Shopee Open Platform の Partner 資格情報を環境変数に設定し、リダイレクトURLをコンソール登録内容と一致させてください。
        </p>
      </div>
    </div>
  );
}

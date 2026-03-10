"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Store, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [code, setCode] = useState("");
  const [shopId, setShopId] = useState("");
  const [country, setCountry] = useState("SG");
  const [connections, setConnections] = useState<ShopeeConnection[]>([]);

  useEffect(() => {
    // Show success/error messages from OAuth redirect
    const connected = searchParams?.get("shopee_connected");
    const error = searchParams?.get("shopee_error");

    if (connected === "true") {
      toast.success("Shopeeアカウントを接続しました");
    } else if (error) {
      toast.error(decodeURIComponent(error));
    }

    // Load existing connections
    loadConnections();
  }, [searchParams]);

  const loadConnections = async () => {
    try {
      const res = await fetch("/api/shopee/status");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/shopee/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, shop_id: shopId, country }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "接続に失敗しました");
      }

      toast.success(`${country}ストアを接続しました`);
      setCode("");
      setShopId("");
      loadConnections();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "接続に失敗しました"
      );
    } finally {
      setLoading(false);
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
              各国のストアのcode と shop_id を入力
            </p>
          </div>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="country" className="text-xs font-medium">
                国 / Country
              </Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop_id" className="text-xs font-medium">
                Shop ID
              </Label>
              <Input
                id="shop_id"
                type="number"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                placeholder="12345678"
                required
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-medium">
                Authorization Code
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="code..."
                required
                className="text-sm font-mono"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="gradient-primary text-primary-foreground shadow-green gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                接続中...
              </>
            ) : (
              <>
                <Store size={14} />
                アカウント接続
              </>
            )}
          </Button>
        </form>
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
        <p className="text-foreground font-semibold text-sm">
          Shopee APIの接続手順
        </p>
        <ol className="text-muted-foreground text-xs space-y-1 list-decimal list-inside">
          <li>
            Shopee Open Platformで Partner ID と Partner Key を取得してください
          </li>
          <li>
            .env ファイルに SHOPEE_PARTNER_ID と SHOPEE_PARTNER_KEY を設定
          </li>
          <li>
            各国のShopeeストア（SG/PH/MY/TW/TH/ID/VN/BR）のcode と shop_id を入力
          </li>
          <li>「アカウント接続」ボタンをクリックしてトークンを取得</li>
        </ol>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Bell,
  Languages,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  getNotificationSoundsEnabled,
  setNotificationSoundsEnabled,
} from "@/lib/notification-sound-settings";
import {
  dispatchShopNotificationsRefresh,
  sumNewNotificationIdsFromSyncResults,
} from "@/lib/chapee-shop-notifications-events";
import { SHOPEE_MARKET_OPTIONS } from "@/lib/shopee-markets";

type TranslationProvider = "deepl" | "google";

type TranslationSettingsResponse = {
  history_provider: TranslationProvider;
  input_provider: TranslationProvider;
  deepl_key_configured: boolean;
  google_key_configured: boolean;
  env_deepl_fallback: boolean;
  env_google_fallback: boolean;
  deepl_key_masked: string | null;
  google_key_masked: string | null;
  deepl_usage: {
    character_count: number;
    character_limit: number;
  } | null;
};

type ShopeeConnection = {
  shop_id: number;
  shop_name?: string;
  country: string;
  expires_at: string;
  updated_at: string;
};

const COUNTRIES = SHOPEE_MARKET_OPTIONS;

export default function SettingsPage() {
  const [oauthLoading, setOauthLoading] = useState(false);
  /** auth_partner の署名に使うマーケット（MY 店と SG 店で同じ Partner でも明示すると安全） */
  const [oauthShopeeMarket, setOauthShopeeMarket] = useState("SG");
  const [syncing, setSyncing] = useState(false);
  const [connections, setConnections] = useState<ShopeeConnection[]>([]);
  const [notificationSoundsOn, setNotificationSoundsOn] = useState(true);

  const [historyProvider, setHistoryProvider] =
    useState<TranslationProvider>("deepl");
  const [inputProvider, setInputProvider] =
    useState<TranslationProvider>("deepl");
  const [deeplKeyDraft, setDeeplKeyDraft] = useState("");
  const [googleKeyDraft, setGoogleKeyDraft] = useState("");
  const [translationMeta, setTranslationMeta] =
    useState<TranslationSettingsResponse | null>(null);
  const [translationLoading, setTranslationLoading] = useState(true);
  const [translationSaving, setTranslationSaving] = useState(false);

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

  const loadTranslationSettings = useCallback(async () => {
    setTranslationLoading(true);
    try {
      const res = await fetch("/api/settings/translation");
      if (!res.ok) return;
      const data = (await res.json()) as TranslationSettingsResponse;
      setTranslationMeta(data);
      setHistoryProvider(data.history_provider);
      setInputProvider(data.input_provider);
      setDeeplKeyDraft("");
      setGoogleKeyDraft("");
    } catch {
      console.error("Failed to load translation settings");
    } finally {
      setTranslationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTranslationSettings();
  }, [loadTranslationSettings]);

  const handleSaveTranslation = async () => {
    setTranslationSaving(true);
    try {
      const res = await fetch("/api/settings/translation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history_provider: historyProvider,
          input_provider: inputProvider,
          deepl_api_key: deeplKeyDraft.trim(),
          google_api_key: googleKeyDraft.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "保存に失敗しました");
      }
      toast.success("翻訳設定を保存しました");
      await loadTranslationSettings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setTranslationSaving(false);
    }
  };

  const handleClearDeeplKey = async () => {
    setTranslationSaving(true);
    try {
      const res = await fetch("/api/settings/translation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history_provider: historyProvider,
          input_provider: inputProvider,
          clear_deepl: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "削除に失敗しました");
      toast.success("DeepL の API キーを削除しました");
      await loadTranslationSettings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setTranslationSaving(false);
    }
  };

  const handleClearGoogleKey = async () => {
    setTranslationSaving(true);
    try {
      const res = await fetch("/api/settings/translation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history_provider: historyProvider,
          input_provider: inputProvider,
          clear_google: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "削除に失敗しました");
      toast.success("Google の API キーを削除しました");
      await loadTranslationSettings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setTranslationSaving(false);
    }
  };

  const handleShopeeOAuth = async () => {
    setOauthLoading(true);
    try {
      const res = await fetch(
        `/api/shopee/auth-url?country=${encodeURIComponent(oauthShopeeMarket)}`,
        { credentials: "include" }
      );
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

      dispatchShopNotificationsRefresh({
        newNotificationIdsTotal: sumNewNotificationIdsFromSyncResults(
          data.results as Array<{
            error?: string;
            delta?: { new_notification_ids?: string[] };
          }>
        ),
      });

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
          翻訳・Shopee連携・通知など
        </p>
      </div>

      {/* Translation (BayChat-style) */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Languages size={14} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">
              翻訳ツール設定
            </p>
            <p className="text-muted-foreground text-xs">
              チャットの翻訳に使うエンジンと API キーを登録します
            </p>
          </div>
        </div>

        {translationLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 size={14} className="animate-spin" />
            読み込み中…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                メッセージ履歴の翻訳
              </Label>
              <RadioGroup
                value={historyProvider}
                onValueChange={(v) =>
                  setHistoryProvider(v as TranslationProvider)
                }
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="deepl" id="tr-h-deepl" />
                  <Label htmlFor="tr-h-deepl" className="font-normal cursor-pointer">
                    DeepL
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="google" id="tr-h-google" />
                  <Label htmlFor="tr-h-google" className="font-normal cursor-pointer">
                    Google翻訳
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                入力メッセージの翻訳
              </Label>
              <p className="text-xs text-muted-foreground">
                将来の入力補助用に保存します（現在のチャット画面は履歴側の設定を使用）
              </p>
              <RadioGroup
                value={inputProvider}
                onValueChange={(v) =>
                  setInputProvider(v as TranslationProvider)
                }
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="deepl" id="tr-i-deepl" />
                  <Label htmlFor="tr-i-deepl" className="font-normal cursor-pointer">
                    DeepL
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="google" id="tr-i-google" />
                  <Label htmlFor="tr-i-google" className="font-normal cursor-pointer">
                    Google翻訳
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <Tabs defaultValue="deepl" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="deepl">DeepL</TabsTrigger>
                <TabsTrigger value="google">Google翻訳</TabsTrigger>
              </TabsList>
              <TabsContent value="deepl" className="space-y-3 mt-4">
                {translationMeta?.deepl_usage && (
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs space-y-1">
                    <p className="font-medium text-foreground">
                      翻訳可能な残りの文字数（DeepL）
                    </p>
                    <p className="text-muted-foreground">
                      今月の利用:{" "}
                      {translationMeta.deepl_usage.character_count.toLocaleString()}{" "}
                      /{" "}
                      {translationMeta.deepl_usage.character_limit.toLocaleString()}{" "}
                      文字
                    </p>
                  </div>
                )}
                {translationMeta?.env_deepl_fallback && (
                  <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 rounded-md px-3 py-2">
                    データベースにキーがないため、環境変数{" "}
                    <code className="text-[11px]">DEEPL_API_KEY</code>{" "}
                    が使われています。下にキーを保存するとアプリ側の設定が優先されます。
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="deepl-key" className="text-xs font-medium">
                    API 認証キー
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="deepl-key"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        translationMeta?.deepl_key_masked
                          ? `保存済み（${translationMeta.deepl_key_masked}）`
                          : "未設定"
                      }
                      value={deeplKeyDraft}
                      onChange={(e) => setDeeplKeyDraft(e.target.value)}
                      className="text-sm font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={translationSaving || !translationMeta?.deepl_key_configured}
                      onClick={handleClearDeeplKey}
                    >
                      キー削除
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    DeepL API は無料枠で発行できます（数分程度）。
                  </p>
                  <a
                    href="https://www.deepl.com/pro-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    DeepL API の取得
                    <ExternalLink size={12} />
                  </a>
                </div>
              </TabsContent>
              <TabsContent value="google" className="space-y-3 mt-4">
                {translationMeta?.env_google_fallback && (
                  <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 rounded-md px-3 py-2">
                    環境変数{" "}
                    <code className="text-[11px]">GOOGLE_TRANSLATE_API_KEY</code>{" "}
                    が使われています。
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="google-key" className="text-xs font-medium">
                    API キー（Cloud Translation API）
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="google-key"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        translationMeta?.google_key_masked
                          ? `保存済み（${translationMeta.google_key_masked}）`
                          : "未設定"
                      }
                      value={googleKeyDraft}
                      onChange={(e) => setGoogleKeyDraft(e.target.value)}
                      className="text-sm font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={translationSaving || !translationMeta?.google_key_configured}
                      onClick={handleClearGoogleKey}
                    >
                      キー削除
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Google Cloud Console で API キーを発行し、Cloud Translation API
                    を有効にしてください。
                  </p>
                  <a
                    href="https://cloud.google.com/translate/docs/setup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    セットアップ手順
                    <ExternalLink size={12} />
                  </a>
                </div>
              </TabsContent>
            </Tabs>

            <Button
              type="button"
              onClick={handleSaveTranslation}
              disabled={translationSaving}
              className="gradient-primary text-primary-foreground gap-2"
            >
              {translationSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  保存中…
                </>
              ) : (
                "保存"
              )}
            </Button>
          </>
        )}
      </div>

      {/* Notification sounds */}
      <div
        id="notification-settings"
        className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4 scroll-mt-24"
      >
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

        <div className="space-y-3">
          <div className="space-y-1.5 max-w-xs">
            <Label
              htmlFor="oauth-shopee-market"
              className="text-xs font-medium text-foreground"
            >
              連携するマーケット
            </Label>
            <select
              id="oauth-shopee-market"
              value={oauthShopeeMarket}
              onChange={(e) => setOauthShopeeMarket(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
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

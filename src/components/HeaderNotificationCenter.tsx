"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Loader2,
  Settings,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ShopCenterNotifItem,
  dedupeShopNotificationItems,
  parseShopNotificationPayload,
} from "@/lib/shopee-shop-notification-parse";

export type { ShopCenterNotifItem };
export { parseShopNotificationPayload };

function formatNotifTime(d?: Date): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Shopee が返す `<b>...</b>` を除去し、太字スタイルで表示 */
function renderShopNotificationContent(html: string): ReactNode {
  if (!html) return null;
  const parts: React.ReactNode[] = [];
  let remaining = html;
  let key = 0;
  const openRe = /<b>/gi;
  const closeRe = /<\/b>/gi;

  while (remaining.length) {
    openRe.lastIndex = 0;
    const openMatch = openRe.exec(remaining);
    if (!openMatch || openMatch.index === undefined) {
      parts.push(remaining);
      break;
    }
    const start = openMatch.index;
    if (start > 0) {
      parts.push(remaining.slice(0, start));
    }
    const afterOpen = remaining.slice(start + openMatch[0].length);
    closeRe.lastIndex = 0;
    const closeMatch = closeRe.exec(afterOpen);
    if (!closeMatch || closeMatch.index === undefined) {
      parts.push(remaining.slice(start));
      break;
    }
    const boldText = afterOpen.slice(0, closeMatch.index);
    parts.push(
      <strong key={`b-${key++}`} className="font-semibold text-foreground">
        {boldText}
      </strong>
    );
    remaining = afterOpen.slice(closeMatch.index + closeMatch[0].length);
  }

  return <>{parts}</>;
}

function HeaderNotificationCenterInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ShopCenterNotifItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | number | undefined>();
  const [shopLabel, setShopLabel] = useState<string | null>(null);
  const [serverUnreadTotal, setServerUnreadTotal] = useState<number | undefined>();

  const fetchPage = useCallback(
    async (opts: { cursor?: string | number; append: boolean }) => {
      const params = new URLSearchParams();
      params.set("page_size", "20");
      if (opts.cursor != null && String(opts.cursor).length > 0) {
        params.set("cursor", String(opts.cursor));
      }
      const res = await fetch(`/api/shopee/shop-notifications?${params}`);
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "通知の取得に失敗しました";
        throw new Error(msg);
      }
      const parsed = parseShopNotificationPayload(json);
      const pageItems = dedupeShopNotificationItems(parsed.items);
      if (parsed.serverUnreadTotal !== undefined) {
        setServerUnreadTotal(parsed.serverUnreadTotal);
      }
      if (opts.append) {
        if (pageItems.length === 0) {
          setNextCursor(undefined);
        } else {
          setItems((prev) =>
            dedupeShopNotificationItems([...prev, ...pageItems])
          );
          setNextCursor(parsed.nextCursor);
        }
      } else {
        setItems(pageItems);
        setNextCursor(parsed.nextCursor);
      }
      if (parsed.shopId != null) {
        setShopLabel(`Shop ${parsed.shopId}`);
      }
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNextCursor(undefined);
    try {
      await fetchPage({ append: false });
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (nextCursor == null || String(nextCursor).length === 0) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({ cursor: nextCursor, append: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, nextCursor]);

  useEffect(() => {
    if (searchParams.get("focus") === "notifications") {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 一覧はそのまま、Shopee の未読総数だけ同期（先頭ページに戻さない） */
  const refreshUnreadFromShopee = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page_size", "1");
      const res = await fetch(`/api/shopee/shop-notifications?${params}`);
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) return;
      const parsed = parseShopNotificationPayload(json);
      if (parsed.serverUnreadTotal !== undefined) {
        setServerUnreadTotal(parsed.serverUnreadTotal);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const intervalMs = 120_000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshUnreadFromShopee();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [refreshUnreadFromShopee]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshUnreadFromShopee();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshUnreadFromShopee]);

  const badgeCount = useMemo(() => {
    if (typeof serverUnreadTotal === "number" && serverUnreadTotal >= 0) {
      return serverUnreadTotal;
    }
    return items.filter((i) => i.isRead === false).length;
  }, [serverUnreadTotal, items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Shopeeセンター通知"
        >
          <Bell size={20} className="text-gray-600" />
          {badgeCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-[18px] text-center border-2 border-white tabular-nums">
              {badgeCount > 99 ? "99+" : String(badgeCount)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(100vw-2rem,22rem)] p-0 overflow-hidden"
        sideOffset={8}
      >
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-muted/40">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Seller Center 通知
            </p>
            {shopLabel && (
              <p className="text-[10px] text-muted-foreground truncate">
                {shopLabel}
              </p>
            )}
          </div>
          <Link
            href="/settings#notification-settings"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
            onClick={() => setOpen(false)}
          >
            <Settings size={12} />
            通知の設定
          </Link>
        </div>
        <ScrollArea className="h-[min(60vh,320px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive px-3 py-8 text-center">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-8 text-center leading-relaxed">
              Seller Center の通知はありません。Shopee 連携とアプリ権限を確認してください。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((r) => (
                <li key={r.id}>
                  <div className="px-3 py-2.5 hover:bg-muted/80 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2 min-w-0">
                        {r.title}
                      </p>
                      {r.createdAt && (
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {formatNotifTime(r.createdAt)}
                        </span>
                      )}
                    </div>
                    {r.content ? (
                      <p className="text-xs text-muted-foreground line-clamp-3 mt-1 [&_strong]:text-foreground">
                        {renderShopNotificationContent(r.content)}
                      </p>
                    ) : null}
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        詳細を開く
                        <ExternalLink size={10} />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="px-3 py-2 border-t border-border bg-muted/20 space-y-1.5">
            {items.length > 0 &&
              nextCursor != null &&
              String(nextCursor).length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    <>
                      さらに読み込む
                      <ChevronDown size={12} className="ml-1" />
                    </>
                  )}
                </Button>
              )}
            <Button variant="ghost" size="sm" className="w-full text-xs h-8" asChild>
              <Link
                href="/chats"
                className="inline-flex items-center justify-center gap-1"
                onClick={() => setOpen(false)}
              >
                チャット管理へ
                <ExternalLink size={12} />
              </Link>
            </Button>
          </div>
      </PopoverContent>
    </Popover>
  );
}

export default function HeaderNotificationCenter() {
  return (
    <Suspense
      fallback={
        <div className="relative p-2.5 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Bell size={20} className="text-gray-400" />
        </div>
      }
    >
      <HeaderNotificationCenterInner />
    </Suspense>
  );
}

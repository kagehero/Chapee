"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { cn } from "@/lib/utils";
import {
  CHAPEE_SHOP_NOTIFICATIONS_REFRESH,
  type ShopNotificationsRefreshDetail,
} from "@/lib/chapee-shop-notifications-events";
import {
  adjustLocalReadCountForServerUnread,
  loadShopNotifReadState,
  markShopNotificationReadInChapee,
  saveShopNotifReadState,
  type ShopNotifPersistedRead,
} from "@/lib/chapee-shop-notifications-read";

export type { ShopCenterNotifItem };
export { parseShopNotificationPayload };

function withShopCountryOnItems(
  items: ShopCenterNotifItem[],
  countryCode: string | undefined
): ShopCenterNotifItem[] {
  const c = countryCode?.trim().toUpperCase();
  if (!c) return items;
  return items.map((i) => (i.country ? i : { ...i, country: c }));
}

/** API 経由の JSON では `Date` が ISO 文字列になるため両方受け取る */
function formatNotifTime(d?: Date | string | number): string {
  if (d == null || d === "") return "";
  let date: Date;
  if (d instanceof Date) {
    date = d;
  } else if (typeof d === "number" && Number.isFinite(d)) {
    date = new Date(d > 1e12 ? d : d * 1000);
  } else if (typeof d === "string") {
    date = new Date(d);
  } else {
    return "";
  }
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
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

function ShopNotifRow({
  item,
  readInChapee,
  onReadInView,
  onClosePopover,
}: {
  item: ShopCenterNotifItem;
  readInChapee: boolean;
  onReadInView: (id: string, shopId?: number) => void;
  onClosePopover?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const didMark = useRef(false);

  useEffect(() => {
    if (readInChapee || didMark.current) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.45) {
            didMark.current = true;
            onReadInView(item.id, item.shopId);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: [0, 0.45, 0.5, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [item.id, readInChapee, onReadInView]);

  return (
    <div
      ref={ref}
      className={cn(
        "px-3 py-2.5 hover:bg-muted/80 transition-colors",
        readInChapee && "opacity-65"
      )}
    >
      {item.country ? (
        <div className="mb-1.5">
          <span
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wide bg-muted text-foreground border border-border"
            title={`マーケット: ${item.country}`}
          >
            {item.country}
          </span>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground line-clamp-2 min-w-0">
          {item.title}
        </p>
        {item.createdAt && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {formatNotifTime(item.createdAt)}
          </span>
        )}
      </div>
      {item.content ? (
        <p className="text-xs text-muted-foreground line-clamp-3 mt-1 [&_strong]:text-foreground">
          {renderShopNotificationContent(item.content)}
        </p>
      ) : null}
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
          onClick={() => {
            didMark.current = true;
            onReadInView(item.id, item.shopId);
            onClosePopover?.();
          }}
        >
          詳細を開く
          <ExternalLink size={10} />
        </a>
      ) : null}
    </div>
  );
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
  /** Shopee が未読件数を返さないとき、同期 delta の新着通知件数でバッジを補う */
  const [syncNotifHint, setSyncNotifHint] = useState(0);

  /** Chapee 内で既読にした通知（Shopee 未読数から減算） */
  const [readState, setReadState] = useState<ShopNotifPersistedRead>({
    readIds: [],
    localReadCount: 0,
    lastServerUnread: undefined,
  });
  const [readTick, setReadTick] = useState(0);
  const [multiShop, setMultiShop] = useState(false);
  const activeShopIdRef = useRef<number | null>(null);
  const multiShopRef = useRef(false);

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

      if (json.multi_shop === true && Array.isArray(json.chapee_merged_items)) {
        multiShopRef.current = true;
        setMultiShop(true);
        const pageItems = dedupeShopNotificationItems(
          json.chapee_merged_items as ShopCenterNotifItem[]
        );
        if (typeof json.chapee_server_unread_total === "number") {
          setServerUnreadTotal(json.chapee_server_unread_total);
        }
        const ids = json.chapee_shop_ids as number[] | undefined;
        if (ids?.length) {
          activeShopIdRef.current = ids[0];
          setShopLabel(
            ids.length > 1
              ? `接続店舗 ${ids.length}件（全マーケット）`
              : `Shop ${ids[0]}`
          );
        }
        if (opts.append) {
          setItems((prev) => dedupeShopNotificationItems([...prev, ...pageItems]));
        } else {
          setItems(pageItems);
        }
        setNextCursor(undefined);
        return;
      }

      multiShopRef.current = false;
      setMultiShop(false);
      const parsed = parseShopNotificationPayload(json);
      const countryFromApi =
        typeof json.chapee_shop_country === "string"
          ? json.chapee_shop_country
          : undefined;
      const pageItems = dedupeShopNotificationItems(
        withShopCountryOnItems(parsed.items, countryFromApi)
      );
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
        const sid = parsed.shopId;
        const switchShop = activeShopIdRef.current !== sid;
        activeShopIdRef.current = sid;
        setShopLabel(`Shop ${sid}`);
        setReadState((prev) => {
          const base =
            opts.append || !switchShop ? prev : loadShopNotifReadState(sid);
          const next = adjustLocalReadCountForServerUnread(
            base,
            parsed.serverUnreadTotal
          );
          saveShopNotifReadState(sid, next);
          return next;
        });
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

  /** POST /api/shopee/sync 完了後に一覧・未読を取り直し、delta 件数でバッジを補強 */
  useEffect(() => {
    const onRefresh = (e: Event) => {
      const d = (e as CustomEvent<ShopNotificationsRefreshDetail>).detail;
      const n = d?.newNotificationIdsTotal;
      if (typeof n === "number" && n > 0) {
        setSyncNotifHint((prev) => prev + n);
      }
      void load();
    };
    window.addEventListener(CHAPEE_SHOP_NOTIFICATIONS_REFRESH, onRefresh);
    return () =>
      window.removeEventListener(CHAPEE_SHOP_NOTIFICATIONS_REFRESH, onRefresh);
  }, [load]);

  /** 一覧はそのまま、Shopee の未読総数だけ同期（先頭ページに戻さない） */
  const refreshUnreadFromShopee = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page_size", "1");
      const res = await fetch(`/api/shopee/shop-notifications?${params}`);
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) return;
      if (json.multi_shop === true && typeof json.chapee_server_unread_total === "number") {
        setServerUnreadTotal(json.chapee_server_unread_total);
        return;
      }
      const parsed = parseShopNotificationPayload(json);
      if (parsed.serverUnreadTotal !== undefined) {
        setServerUnreadTotal(parsed.serverUnreadTotal);
      }
      const sid = parsed.shopId ?? activeShopIdRef.current;
      if (sid != null) {
        activeShopIdRef.current = sid;
        setReadState((prev) => {
          const next = adjustLocalReadCountForServerUnread(
            prev,
            parsed.serverUnreadTotal
          );
          saveShopNotifReadState(sid, next);
          return next;
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const markNotificationReadInChapee = useCallback((id: string, shopId?: number) => {
    const sid = shopId ?? activeShopIdRef.current;
    if (sid == null) return;
    const prev = loadShopNotifReadState(sid);
    const next = markShopNotificationReadInChapee(sid, id, prev);
    if (next === prev) return;
    saveShopNotifReadState(sid, next);
    setReadTick((t) => t + 1);
    if (!multiShopRef.current) {
      setReadState(next);
    }
    if (next.readIds.length > prev.readIds.length) {
      queueMicrotask(() => setSyncNotifHint((h) => Math.max(0, h - 1)));
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

  const readIdsSet = useMemo(
    () => new Set(readState.readIds),
    [readState.readIds]
  );

  const multiShopLocalReadSum = useMemo(() => {
    if (!multiShop || items.length === 0) return 0;
    const ids = new Set<number>();
    for (const i of items) {
      if (i.shopId != null) ids.add(i.shopId);
    }
    let sum = 0;
    for (const sid of ids) {
      sum += loadShopNotifReadState(sid).localReadCount;
    }
    return sum;
  }, [multiShop, items, readTick]);

  const baseBadgeCount = useMemo(() => {
    if (typeof serverUnreadTotal === "number" && serverUnreadTotal >= 0) {
      if (multiShop) {
        const cap = Math.min(multiShopLocalReadSum, serverUnreadTotal);
        return Math.max(0, serverUnreadTotal - cap);
      }
      const cap = Math.min(readState.localReadCount, serverUnreadTotal);
      return Math.max(0, serverUnreadTotal - cap);
    }
    return items.filter((i) => {
      if (i.isRead === true) return false;
      const sid = i.shopId ?? activeShopIdRef.current;
      if (sid != null) {
        return !loadShopNotifReadState(sid).readIds.includes(i.id);
      }
      return !readIdsSet.has(i.id);
    }).length;
  }, [
    serverUnreadTotal,
    multiShop,
    multiShopLocalReadSum,
    readState.localReadCount,
    items,
    readIdsSet,
    readTick,
  ]);

  useEffect(() => {
    if (
      syncNotifHint > 0 &&
      typeof serverUnreadTotal === "number" &&
      serverUnreadTotal >= syncNotifHint
    ) {
      setSyncNotifHint(0);
    }
  }, [serverUnreadTotal, syncNotifHint]);

  const badgeCount = useMemo(
    () => Math.max(baseBadgeCount, syncNotifHint),
    [baseBadgeCount, syncNotifHint]
  );

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
              {items.map((r) => {
                const sid = r.shopId ?? activeShopIdRef.current;
                const readInChapee =
                  r.isRead === true ||
                  (sid != null
                    ? loadShopNotifReadState(sid).readIds.includes(r.id)
                    : readIdsSet.has(r.id));
                return (
                  <li key={`${r.shopId ?? 0}-${r.id}`}>
                    <ShopNotifRow
                      item={r}
                      readInChapee={readInChapee}
                      onReadInView={markNotificationReadInChapee}
                      onClosePopover={() => setOpen(false)}
                    />
                  </li>
                );
              })}
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

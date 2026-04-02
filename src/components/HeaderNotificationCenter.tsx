"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Loader2, Settings, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
type NotificationRow = {
  id: string;
  country: string;
  customer: string;
  lastMessage: string;
  time: string;
  date: string;
  unread: number;
};

function HeaderNotificationCenterInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chats?type=notification&limit=40");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const list = (data.chats || []) as Array<{
        id: string;
        country: string;
        customer: string;
        lastMessage: string;
        time: string;
        date: string;
        unread: number;
      }>;
      setRows(
        list.map((c) => ({
          id: String(c.id),
          country: c.country,
          customer: c.customer,
          lastMessage: c.lastMessage,
          time: c.time,
          date: c.date ?? "",
          unread: c.unread ?? 0,
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("focus") === "notifications") {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const unreadTotal = rows.reduce((s, r) => s + (r.unread > 0 ? r.unread : 0), 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Shopee通知"
        >
          <Bell size={20} className="text-gray-600" />
          {unreadTotal > 0 && (
            <span className="absolute top-2 right-2 min-w-[8px] h-2 px-0.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(100vw-2rem,22rem)] p-0 overflow-hidden"
        sideOffset={8}
      >
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-muted/40">
          <p className="text-sm font-semibold text-foreground">Shopee通知</p>
          <Link
            href="/settings#notification-settings"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
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
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-8 text-center">
              通知スレッドはありません。同期後、Shopee公式通知などがここに表示されます。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/chats/${encodeURIComponent(r.id)}`);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
                        {r.country}
                      </span>
                      {r.unread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {r.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mt-0.5">
                      {r.customer}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {r.lastMessage}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {r.date} {r.time}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        {rows.length > 0 && (
          <div className="px-3 py-2 border-t border-border bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-8"
              asChild
            >
              <Link
                href="/chats"
                className="inline-flex items-center justify-center gap-1"
                onClick={() => setOpen(false)}
              >
                バイヤーチャット一覧へ
                <ExternalLink size={12} />
              </Link>
            </Button>
          </div>
        )}
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

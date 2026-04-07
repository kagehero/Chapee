"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
} from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Send, Languages, Package, Clock,
  ChevronDown, FileText, ShoppingBag, Copy, User, Info,
  Paperclip, Image as ImageIcon, File, X, Loader2, ExternalLink,
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNotificationSounds } from "@/lib/useNotificationSounds";

type AttachedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

/** manual=手動 template=テンプレ auto=Chapee自動返信 auto_hint=Shopee側の自動っぽいメッセージ */
type StaffSendKind =
  | "manual"
  | "template"
  | "auto"
  | "auto_hint"
  | "unknown";

type MessageContentKind = "text" | "item" | "order" | "sticker" | "image";

type Message = {
  id: string | number;
  sender: "customer" | "staff";
  content: string;
  time: string;
  content_kind?: MessageContentKind;
  item_card?: {
    item_id?: string;
    name?: string;
    image_url?: string;
    shop_id?: string;
    related_order_sn?: string;
  };
  order_card?: { order_sn?: string };
  sticker_card?: { image_url?: string; sticker_id?: string; package_id?: string };
  image_card?: { url?: string };
  order_url?: string;
  item_url?: string;
  /** 日付付き（例: 2026/03/28 14:30） */
  datetime?: string;
  /** YYYY-MM-DD（日付区切り線用） */
  date_key?: string;
  timestamp_ms?: number;
  translated: boolean;
  attachments?: AttachedFile[];
  /** 店舗側メッセージのみ。手動 / テンプレ / Shopee から推定の自動 */
  staffSendKind?: StaffSendKind;
};

function chatBubbleShell(isStaff: boolean) {
  return cn(
    "rounded-2xl px-3.5 py-2.5 text-sm shadow-sm border",
    isStaff
      ? "gradient-primary text-primary-foreground border-primary/30 rounded-br-md"
      : "bg-slate-100 dark:bg-muted text-foreground border-slate-200 dark:border-border rounded-bl-md"
  );
}

function ChatMessageBody({ msg, isStaff }: { msg: Message; isStaff: boolean }) {
  const card = chatBubbleShell(isStaff);
  const kind = msg.content_kind ?? "text";

  if (kind === "sticker") {
    return (
      <div className={card}>
        {msg.sticker_card?.image_url ? (
          <img
            src={msg.sticker_card.image_url}
            alt="スタンプ"
            className="max-h-36 max-w-[min(180px,70vw)] rounded-md object-contain mx-auto"
          />
        ) : (
          <p className="text-center text-sm">スタンプ</p>
        )}
      </div>
    );
  }

  if (kind === "item") {
    return (
      <div className={card}>
        <div className="flex gap-2.5 items-start">
          {msg.item_card?.image_url ? (
            <img
              src={msg.item_card.image_url}
              alt={msg.item_card?.name?.trim() || "商品"}
              className="w-16 h-16 rounded-md object-cover shrink-0 border border-black/10"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold opacity-80 mb-0.5">商品</p>
            <p className="text-sm font-medium leading-snug break-words">
              {msg.item_card?.name ?? msg.content}
            </p>
            {msg.item_card?.item_id ? (
              <p className="text-[10px] opacity-70 mt-1 tabular-nums">ID: {msg.item_card.item_id}</p>
            ) : null}
            {msg.item_card?.related_order_sn ? (
              <p className="text-[10px] opacity-70 mt-1 font-mono break-all">
                関連注文: {msg.item_card.related_order_sn}
              </p>
            ) : null}
            {msg.item_url ? (
              <a
                href={msg.item_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 text-xs mt-2 underline underline-offset-2",
                  isStaff ? "text-primary-foreground/95" : "text-primary"
                )}
              >
                商品ページを開く
                <ExternalLink size={10} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (kind === "order") {
    return (
      <div className={card}>
        <p className="text-[11px] font-semibold opacity-80 mb-1">注文</p>
        {msg.order_card?.order_sn ? (
          <p className="text-sm font-mono break-all">{msg.order_card.order_sn}</p>
        ) : null}
        {msg.order_url ? (
          <a
            href={msg.order_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 text-xs mt-2 underline underline-offset-2",
              isStaff ? "text-primary-foreground/95" : "text-primary"
            )}
          >
            セラー注文を開く
            <ExternalLink size={10} />
          </a>
        ) : null}
      </div>
    );
  }

  if (kind === "image") {
    const u = msg.image_card?.url;
    return (
      <div className={card}>
        {u ? (
          <img src={u} alt="画像" className="max-w-[min(280px,85vw)] rounded-md object-contain" />
        ) : (
          <span className="text-sm">画像</span>
        )}
      </div>
    );
  }

  if (msg.content) {
    return <div className={card}>{msg.content}</div>;
  }
  return null;
}

function formatMessageTimestamps(ms: number) {
  const d = new Date(ms);
  return {
    time: d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    datetime: d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    date_key: d.toISOString().slice(0, 10),
    timestamp_ms: ms,
  };
}

function dateKeyToLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** `/api/reply-templates` とテンプレート管理画面と同期 */
type ReplyTemplateRow = {
  id: string;
  country: string;
  category: string;
  name: string;
  content: string;
  autoReply: boolean;
  langs: string[];
};

function groupReplyTemplatesByCategory(
  rows: ReplyTemplateRow[],
  country: string | null | undefined
): { category: string; items: ReplyTemplateRow[] }[] {
  const filtered =
    country == null || country === ""
      ? rows
      : rows.filter(
          (t) => t.country === "全て" || t.country === country
        );
  const map = new Map<string, ReplyTemplateRow[]>();
  for (const t of filtered) {
    const cat = t.category?.trim() || "その他";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(t);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((x, y) => x.name.localeCompare(y.name, "ja")),
    }));
}

function StaffKindBadge({ kind }: { kind?: StaffSendKind }) {
  if (!kind || kind === "unknown") return null;
  const cfg =
    kind === "manual"
      ? {
          label: "手動",
          className:
            "bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100",
        }
      : kind === "template"
        ? {
            label: "テンプレ",
            className:
              "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
          }
        : kind === "auto"
          ? {
              label: "自動返信",
              className:
                "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
            }
          : kind === "auto_hint"
            ? {
                label: "自動(推定)",
                className:
                  "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
              }
            : {
                label: "自動",
                className:
                  "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
              };
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function ChatParticipantAvatar({
  imageUrl,
  isStaff,
  nameFallback,
  size = "md",
  variant = "default",
}: {
  imageUrl?: string | null;
  isStaff: boolean;
  nameFallback?: string;
  size?: "sm" | "md";
  variant?: "default" | "header";
}) {
  const [broken, setBroken] = useState(false);
  const show = Boolean(imageUrl) && !broken;
  const sz = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const iconSz = size === "sm" ? 14 : 18;
  return (
    <div
      className={cn(
        "flex-shrink-0 rounded-full flex items-center justify-center border-2 overflow-hidden",
        sz,
        variant === "header"
          ? "border-primary-foreground/35 bg-primary-foreground/15 text-primary-foreground"
          : isStaff
            ? "border-primary bg-primary/15 text-primary"
            : "border-muted-foreground/25 bg-muted text-muted-foreground"
      )}
      title={
        !isStaff && !show && nameFallback?.trim()
          ? nameFallback.trim()
          : undefined
      }
      aria-hidden
    >
      {show ? (
        <img
          src={imageUrl as string}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
          referrerPolicy="no-referrer"
        />
      ) : isStaff ? (
        <ShoppingBag size={iconSz} />
      ) : (
        <User size={iconSz} strokeWidth={2} />
      )}
    </div>
  );
}

type ConversationType = {
  id: string;
  customer_name: string;
  customer_id: number;
  country: string;
  shop_id: number;
  customer_avatar_url?: string | null;
  shop_logo_url?: string | null;
};

type OrderInfo = {
  order_sn: string;
  order_status: string;
  currency: string;
  total_amount: number;
  item_preview: string;
  item_image_url?: string;
  item_count: number;
  order_url: string;
};

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [replyTemplates, setReplyTemplates] = useState<ReplyTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [translating, setTranslating] = useState<string | number | null>(null);
  const [translatingInput, setTranslatingInput] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playMessageSound, playOrderSound } = useNotificationSounds();
  const isFirstMessagesLoadRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  /** テンプレ選択直後の ID（送信時に本文一致なら「テンプレ」扱い） */
  const pendingTemplateIdRef = useRef<string | null>(null);
  /** 連打で同一メッセージが複数送信されるのを防ぐ（setState より先に同期ガード） */
  const sendLockRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);

  const loadReplyTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/reply-templates");
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { templates?: ReplyTemplateRow[] };
      setReplyTemplates(data.templates ?? []);
    } catch {
      toast.error("テンプレートの読み込みに失敗しました");
      setReplyTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const groupedReplyTemplates = useMemo(
    () => groupReplyTemplatesByCategory(replyTemplates, conversation?.country),
    [replyTemplates, conversation?.country]
  );

  /** 会話内に現れたスタンプ（package_id + sticker_id）— Shopee はパック一覧 API が無いため、受信済みスタンプから返信用に使う */
  const stickerChoicesFromThread = useMemo(() => {
    const m = new Map<
      string,
      { sticker_id: string; package_id: string; image_url?: string }
    >();
    for (const msg of messages) {
      if (msg.content_kind !== "sticker") continue;
      const c = msg.sticker_card;
      const sid = c?.sticker_id?.trim();
      const pid = c?.package_id?.trim();
      if (!sid || !pid) continue;
      const k = `${pid}:${sid}`;
      if (!m.has(k)) {
        m.set(k, {
          sticker_id: sid,
          package_id: pid,
          image_url: c?.image_url,
        });
      }
    }
    return Array.from(m.values());
  }, [messages]);

  /** 会話メッセージから商品カードを集約（未注文の問い合わせでもサイドで確認できるように） */
  const relatedProductsFromChat = useMemo(() => {
    const m = new Map<
      string,
      {
        item_id?: string;
        name: string;
        image_url?: string;
        item_url?: string;
      }
    >();
    for (const msg of messages) {
      if (msg.content_kind !== "item") continue;
      const card = msg.item_card;
      const id = card?.item_id?.trim();
      const name = (card?.name ?? msg.content ?? "").trim();
      if (!id && !name) continue;
      const key = id || `name:${name}`;
      if (m.has(key)) continue;
      m.set(key, {
        ...(id ? { item_id: id } : {}),
        name: name || "商品",
        image_url: card?.image_url,
        item_url: msg.item_url,
      });
    }
    return Array.from(m.values());
  }, [messages]);

  // Load messages from API
  useEffect(() => {
    if (id) {
      loadMessages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadReplyTemplates();
  }, [id, loadReplyTemplates]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setOrdersLoading(true);
      try {
        const res = await fetch(
          `/api/chats/${encodeURIComponent(id)}/orders`
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Play notification sound when new customer messages arrive (API-loaded thread)
  useEffect(() => {
    if (!messages.length) {
      lastMessageCountRef.current = 0;
      return;
    }

    // Skip sound on very first load
    if (isFirstMessagesLoadRef.current) {
      isFirstMessagesLoadRef.current = false;
      lastMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length <= lastMessageCountRef.current) return;

    const newMessages = messages.slice(lastMessageCountRef.current);
    const hasIncomingCustomerMessage = newMessages.some(
      (m) => m.sender === "customer"
    );

    if (hasIncomingCustomerMessage) {
      playMessageSound();
    }

    lastMessageCountRef.current = messages.length;
  }, [messages, playMessageSound]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/chats/${encodeURIComponent(id)}/messages`
      );
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setConversation(data.conversation);
      const raw = (data.messages || []) as Array<{
        id?: string | number;
        sender?: string;
        content?: string;
        time?: string;
        datetime?: string;
        date_key?: string;
        timestamp_ms?: number;
        staff_send_kind?: string;
        content_kind?: MessageContentKind;
        item_card?: Message["item_card"];
        order_card?: Message["order_card"];
        sticker_card?: Message["sticker_card"];
        image_card?: Message["image_card"];
        order_url?: string;
        item_url?: string;
      }>;
      setMessages(
        raw.map((m) => {
          const sender = m.sender === "staff" ? "staff" : "customer";
          const staffSendKind: StaffSendKind | undefined =
            sender === "staff"
              ? m.staff_send_kind === "manual"
                ? "manual"
                : m.staff_send_kind === "template"
                  ? "template"
                  : m.staff_send_kind === "auto"
                    ? "auto"
                    : m.staff_send_kind === "auto_hint"
                      ? "auto_hint"
                      : "unknown"
              : undefined;
          const tsMs =
            typeof m.timestamp_ms === "number"
              ? m.timestamp_ms
              : undefined;
          const fallbackTs = tsMs != null ? formatMessageTimestamps(tsMs) : null;
          return {
            id: String(m.id ?? ""),
            sender,
            content: String(m.content ?? ""),
            content_kind: m.content_kind ?? "text",
            item_card: m.item_card,
            order_card: m.order_card,
            sticker_card: m.sticker_card,
            image_card: m.image_card,
            order_url: m.order_url,
            item_url: m.item_url,
            time: String(m.time ?? ""),
            datetime: m.datetime ?? fallbackTs?.datetime,
            date_key: m.date_key ?? fallbackTs?.date_key,
            timestamp_ms: tsMs ?? fallbackTs?.timestamp_ms,
            translated: false,
            staffSendKind,
          };
        })
      );
    } catch (error) {
      console.error("Load messages error:", error);
      toast.error("メッセージの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loading || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages.length]);

  /** 入力欄: 日本語多め→英語、英語多め→日本語（API 側で自動判定） */
  const handleTranslateInput = async () => {
    const text = inputMessage.trim();
    if (!text) {
      toast.error("翻訳するテキストを入力してください");
      return;
    }
    setTranslatingInput(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang: "auto" }),
      });
      const data = (await res.json()) as {
        text?: string;
        target_lang?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "翻訳に失敗しました");
      }
      if (!data.text) {
        throw new Error("翻訳結果が空です");
      }
      setInputMessage(data.text);
      const tl = data.target_lang?.toUpperCase().replace(/-.*/, "");
      toast.success(
        tl === "EN"
          ? "英語に翻訳して入力欄に反映しました"
          : "日本語に翻訳して入力欄に反映しました"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "翻訳に失敗しました");
    } finally {
      setTranslatingInput(false);
    }
  };

  const handleTranslate = async (msgId: string | number, content: string) => {
    const key = String(msgId);
    setTranslating(msgId);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, target_lang: "auto" }),
      });
      const data = (await res.json()) as {
        text?: string;
        target_lang?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "翻訳に失敗しました");
      }
      if (!data.text) {
        throw new Error("翻訳結果が空です");
      }
      const tl = data.target_lang?.toUpperCase().replace(/-.*/, "");
      const prefix = tl === "EN" ? "[英訳]" : "[日訳]";
      setTranslatedMessages((prev) => ({
        ...prev,
        [key]: `${prefix} 「${data.text}」`,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "翻訳に失敗しました");
    } finally {
      setTranslating(null);
    }
  };


  const handleSendSticker = async (
    stickerPackageId: string,
    stickerRowId: string
  ) => {
    if (sendLockRef.current || sending) return;
    sendLockRef.current = true;
    setSending(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(id)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sticker_package_id: stickerPackageId,
          sticker_id: stickerRowId,
          send_kind: "manual",
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "スタンプの送信に失敗しました");
      }
      const preview = stickerChoicesFromThread.find(
        (s) =>
          s.sticker_id === stickerRowId && s.package_id === stickerPackageId
      );
      const ts = formatMessageTimestamps(Date.now());
      const newMessage: Message = {
        id: String(Date.now()),
        sender: "staff",
        content: "スタンプ",
        content_kind: "sticker",
        sticker_card: {
          sticker_id: stickerRowId,
          package_id: stickerPackageId,
          image_url: preview?.image_url,
        },
        time: ts.time,
        datetime: ts.datetime,
        date_key: ts.date_key,
        timestamp_ms: ts.timestamp_ms,
        translated: false,
        staffSendKind: "manual",
      };
      setMessages((prev) => [...prev, newMessage]);
      setStickerPickerOpen(false);
      toast.success("スタンプを送信しました");
    } catch (error) {
      console.error("Sticker send error:", error);
      toast.error(
        error instanceof Error ? error.message : "スタンプの送信に失敗しました"
      );
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (sendLockRef.current || sending) return;
    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    const tplId = pendingTemplateIdRef.current;
    pendingTemplateIdRef.current = null;
    const tplRow =
      tplId != null ? replyTemplates.find((t) => t.id === tplId) : undefined;
    const isTplSend =
      tplId != null &&
      tplRow != null &&
      inputMessage.trim() === tplRow.content.trim();
    const staffSendKind: StaffSendKind = isTplSend ? "template" : "manual";

    sendLockRef.current = true;
    setSending(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(id)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputMessage,
          send_kind: staffSendKind === "template" ? "template" : "manual",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "送信に失敗しました");
      }

      const ts = formatMessageTimestamps(Date.now());
      const newMessage: Message = {
        id: Date.now(),
        sender: "staff",
        content: inputMessage,
        content_kind: "text",
        time: ts.time,
        datetime: ts.datetime,
        date_key: ts.date_key,
        timestamp_ms: ts.timestamp_ms,
        translated: false,
        attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
        staffSendKind,
      };
      
      setMessages((prev) => [...prev, { ...newMessage, id: String(newMessage.id) }]);
      setInputMessage("");
      setAttachedFiles([]);
      toast.success("メッセージを送信しました");
    } catch (error) {
      console.error("Send error:", error);
      toast.error(error instanceof Error ? error.message : "送信に失敗しました");
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`);
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert(`${file.name} is not a supported file type.`);
        return;
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      const newFile: AttachedFile = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        type: file.type,
        url,
      };

      setAttachedFiles(prev => [...prev, newFile]);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) URL.revokeObjectURL(file.url);
      return prev.filter(f => f.id !== id);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const selectTemplate = (t: ReplyTemplateRow) => {
    setInputMessage(t.content);
    pendingTemplateIdRef.current = t.id;
    setShowTemplates(false);
  };

  const customerOrderPanel = (
    <div className="space-y-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/dashboard")}
        className="gap-1.5 w-full justify-start"
      >
        <ArrowLeft size={14} />
        一覧に戻る
      </Button>

      {conversation && (
        <>
          <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center">
                <User size={14} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm">{conversation.customer_name}</p>
                <p className="text-muted-foreground text-xs">{conversation.country}顧客</p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">国</span>
                <span className="font-semibold px-1.5 py-0.5 gradient-primary text-primary-foreground rounded text-xs">
                  {conversation.country}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shop ID</span>
                <span className="text-foreground font-medium">{conversation.shop_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer ID</span>
                <span className="text-foreground font-medium">{conversation.customer_id}</span>
              </div>
            </div>
          </div>

          {relatedProductsFromChat.length > 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <ShoppingBag size={14} className="text-primary" />
                <p className="text-foreground font-semibold text-sm">
                  関連商品（チャット）
                </p>
              </div>
              <TooltipProvider delayDuration={250}>
                <ul className="space-y-2 max-h-[min(36vh,280px)] overflow-y-auto scrollbar-thin">
                  {relatedProductsFromChat.map((p, i) => (
                    <li
                      key={p.item_id ?? `n-${i}-${p.name}`}
                      className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs"
                    >
                      <div className="flex gap-2 items-start min-w-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="w-10 h-10 rounded-md object-cover shrink-0 border border-border"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground font-medium line-clamp-3 leading-snug">
                            {p.name}
                          </p>
                          {p.item_id ? (
                            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                              ID: {p.item_id}
                            </p>
                          ) : null}
                          {p.item_url ? (
                            <a
                              href={p.item_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary font-medium mt-1 hover:underline"
                            >
                              商品ページ
                              <ExternalLink size={12} className="shrink-0" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </TooltipProvider>
            </div>
          ) : null}

          <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <Package size={14} className="text-primary" />
              <p className="text-foreground font-semibold text-sm">注文情報</p>
            </div>
            {ordersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                <Loader2 size={14} className="animate-spin" />
                読み込み中…
              </div>
            ) : orders.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                直近90日の注文一覧から該当する注文が見つかりませんでした。
                {relatedProductsFromChat.length > 0 ? (
                  <>
                    {" "}
                    上の「関連商品」またはメッセージ内の商品カードをご確認ください。
                  </>
                ) : (
                  <>
                    {" "}
                    未購入のお問い合わせの場合は、メッセージ内の商品カードが表示されます。
                  </>
                )}
              </p>
            ) : (
              <TooltipProvider delayDuration={250}>
                <ul className="space-y-2 max-h-[min(40vh,320px)] overflow-y-auto scrollbar-thin">
                  {orders.map((o) => {
                    const nameFull =
                      o.item_preview +
                      (o.item_count > 1 ? ` ほか${o.item_count - 1}点` : "");
                    return (
                      <li
                        key={o.order_sn}
                        className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs"
                      >
                        <a
                          href={o.order_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-semibold text-primary hover:underline inline-flex items-center gap-1 break-all"
                        >
                          {o.order_sn}
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                        <div className="text-muted-foreground mt-0.5">
                          {[o.order_status, o.currency && o.total_amount > 0 ? `${o.currency} ${o.total_amount.toLocaleString()}` : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {o.item_preview || o.item_image_url ? (
                          <div className="mt-1 flex gap-2 items-start min-w-0">
                            {o.item_image_url ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="shrink-0 rounded-md border border-border bg-muted p-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label="商品画像を拡大表示"
                                  >
                                    <img
                                      src={o.item_image_url}
                                      alt=""
                                      className="w-10 h-10 rounded-md object-cover block"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  align="start"
                                  className="p-2 max-w-[min(280px,calc(100vw-2rem))] border bg-popover shadow-lg"
                                >
                                  <img
                                    src={o.item_image_url}
                                    alt=""
                                    className="max-h-64 max-w-full w-auto rounded-md object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                            {o.item_preview ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-foreground line-clamp-2 min-w-0 flex-1 text-left cursor-default border-b border-dotted border-transparent hover:border-muted-foreground/40">
                                    {o.item_preview}
                                    {o.item_count > 1
                                      ? ` ほか${o.item_count - 1}点`
                                      : ""}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  align="start"
                                  className="max-w-sm text-xs leading-relaxed"
                                >
                                  <p className="whitespace-pre-wrap break-words">
                                    {nameFull}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </TooltipProvider>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 animate-fade-in min-h-0">
      {/* Left: Customer Info - desktop only */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col min-h-0">
        {customerOrderPanel}
      </div>

      {/* Mobile: Customer info in Sheet */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] overflow-y-auto">
          <SheetTitle className="sr-only">顧客・注文情報</SheetTitle>
          {customerOrderPanel}
        </SheetContent>
      </Sheet>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-card overflow-hidden min-h-0 min-w-0">
        {/* Chat Header */}
        <div className="px-3 sm:px-4 py-3 border-b border-border flex items-center justify-between gap-2 gradient-primary flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0 h-9 w-9 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => router.push("/dashboard")}
              aria-label="一覧に戻る"
            >
              <ArrowLeft size={18} />
            </Button>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-primary-foreground hover:bg-primary-foreground/20 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="顧客・注文情報"
            >
              <Info size={18} />
            </button>
            <ChatParticipantAvatar
              imageUrl={conversation?.customer_avatar_url}
              isStaff={false}
              nameFallback={conversation?.customer_name}
              size="sm"
              variant="header"
            />
            <p className="text-primary-foreground font-semibold text-sm truncate">
              {conversation?.customer_name || "読み込み中..."} とのチャット
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification sound test buttons (dev only) */}
            <button
              type="button"
              onClick={playMessageSound}
              className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 transition-colors"
            >
              メッセージ音テスト
            </button>
            <button
              type="button"
              onClick={playOrderSound}
              className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 transition-colors"
            >
              売上音テスト
            </button>
            <span className="text-primary-foreground/80 text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full">
              {conversation?.country || "..."}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              メッセージはありません
            </div>
          ) : (
            messages.map((msg, index) => {
              const isStaff = msg.sender === "staff";
              const prev = index > 0 ? messages[index - 1] : null;
              const showDateDivider =
                Boolean(msg.date_key) &&
                (!prev?.date_key || prev.date_key !== msg.date_key);
              return (
                <Fragment key={msg.id}>
                  {showDateDivider && msg.date_key && (
                    <div className="flex justify-center py-2">
                      <span className="text-[11px] text-muted-foreground bg-muted/90 px-3 py-1 rounded-full border border-border">
                        {dateKeyToLabel(msg.date_key)}
                      </span>
                    </div>
                  )}
                <div
                  className={cn("flex gap-2 items-end", isStaff ? "flex-row-reverse" : "flex-row")}
                >
                  <ChatParticipantAvatar
                    imageUrl={
                      isStaff
                        ? conversation?.shop_logo_url
                        : conversation?.customer_avatar_url
                    }
                    isStaff={isStaff}
                    nameFallback={
                      isStaff ? undefined : conversation?.customer_name
                    }
                  />
                  <div
                    className={cn(
                      "flex flex-col min-w-0 max-w-[calc(100%-3rem)] sm:max-w-[min(75%,28rem)] space-y-1",
                      isStaff ? "items-end" : "items-start"
                    )}
                  >
                    {(!isStaff ||
                      (msg.staffSendKind && msg.staffSendKind !== "unknown")) && (
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-1.5",
                          isStaff ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        {!isStaff && (
                          <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-[min(12rem,45vw)]">
                            {conversation?.customer_name?.trim() || "バイヤー"}
                          </span>
                        )}
                        {isStaff && (
                          <StaffKindBadge kind={msg.staffSendKind} />
                        )}
                      </div>
                    )}

                    {((msg.content_kind ?? "text") !== "text" ||
                      (msg.content && msg.content.trim())) && (
                      <ChatMessageBody msg={msg} isStaff={isStaff} />
                    )}

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-2 w-full">
                        {msg.attachments.map((file: AttachedFile) => (
                          <div key={file.id}>
                            {file.type.startsWith("image/") ? (
                              <div
                                className={cn(
                                  "rounded-xl overflow-hidden shadow-md border-2 max-w-[300px]",
                                  isStaff ? "border-primary" : "border-gray-200"
                                )}
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(file.url, "_blank")}
                                />
                                <div
                                  className={cn(
                                    "px-2 py-1.5 text-xs",
                                    isStaff ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
                                  )}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <ImageIcon size={12} />
                                    <span className="truncate flex-1">{file.name}</span>
                                    <span className="text-xs opacity-75">{formatFileSize(file.size)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "rounded-xl px-3 py-2.5 shadow-sm border-2 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity",
                                  isStaff
                                    ? "gradient-primary text-primary-foreground border-primary"
                                    : "bg-white text-gray-900 border-gray-200"
                                )}
                                onClick={() => window.open(file.url, "_blank")}
                              >
                                <File size={20} className={isStaff ? "text-white" : "text-gray-600"} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{file.name}</p>
                                  <p
                                    className={cn(
                                      "text-xs",
                                      isStaff ? "text-white/80" : "text-gray-500"
                                    )}
                                  >
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>
                                <Paperclip size={16} className={isStaff ? "text-white/60" : "text-gray-400"} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {translatedMessages[String(msg.id)] && (
                      <div className="bg-primary-subtle border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary max-w-full">
                        {translatedMessages[String(msg.id)]}
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex items-center gap-2",
                        isStaff ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {msg.datetime ?? msg.time}
                      </span>
                      {(msg.content_kind ?? "text") === "text" &&
                        msg.content.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleTranslate(msg.id, msg.content)}
                          className="text-xs text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
                          disabled={translating === msg.id}
                          title={
                            msg.sender === "staff"
                              ? "自分が送ったメッセージを翻訳"
                              : "バイヤーのメッセージを翻訳"
                          }
                        >
                          <Languages size={11} />
                          {translating === msg.id ? "翻訳中..." : "翻訳"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                </Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} aria-hidden className="h-px w-full shrink-0" />
        </div>

        {/* Template Picker */}
        {showTemplates && (
          <div className="border-t border-border p-3 bg-muted/50 max-h-48 overflow-y-auto scrollbar-thin">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              テンプレート選択（テンプレート管理と同期）
            </p>
            {templatesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="animate-spin size-4 shrink-0" />
                読み込み中…
              </div>
            ) : groupedReplyTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                この国向けのテンプレートがありません。テンプレート画面で追加するか、国を「全て」に設定してください。
              </p>
            ) : (
              <div className="space-y-2">
                {groupedReplyTemplates.map(({ category, items }) => (
                  <div key={category}>
                    <p className="text-xs font-medium text-primary mb-1">{category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectTemplate(item)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-card border border-border hover:border-primary hover:text-primary transition-all"
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border p-3 space-y-2 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary-subtle min-h-[44px] sm:min-h-0"
              onClick={() => {
                const next = !showTemplates;
                setShowTemplates(next);
                if (next) void loadReplyTemplates();
              }}
            >
              <FileText size={12} />
              テンプレート
              <ChevronDown size={10} className={cn("transition-transform", showTemplates && "rotate-180")} />
            </Button>
            <Popover open={stickerPickerOpen} onOpenChange={setStickerPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  className="h-8 sm:h-7 text-xs gap-1 min-h-[44px] sm:min-h-0 text-primary"
                  title="この会話で受信したスタンプから返信（同じパック）"
                >
                  <Smile size={12} />
                  スタンプ
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[min(100vw-2rem,20rem)] p-3"
                sideOffset={6}
              >
                <p className="text-xs font-semibold text-foreground mb-2">
                  会話内のスタンプで返信
                </p>
                {stickerChoicesFromThread.length === 0 ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    まだスタンプのやり取りがありません。バイヤーがスタンプを送ると、ここに表示され同じパックから返信できます。
                  </p>
                ) : (
                  <ul className="grid grid-cols-4 gap-2 max-h-[min(50vh,240px)] overflow-y-auto scrollbar-thin">
                    {stickerChoicesFromThread.map((s) => (
                      <li key={`${s.package_id}:${s.sticker_id}`}>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() =>
                            void handleSendSticker(s.package_id, s.sticker_id)
                          }
                          className="w-full aspect-square rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/50 transition-colors flex items-center justify-center p-1 overflow-hidden"
                          title="このスタンプを送信"
                        >
                          {s.image_url ? (
                            <img
                              src={s.image_url}
                              alt=""
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <Smile className="size-7 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                  Shopee
                  の公式スタンプ一覧APIがないため、セラーアプリと同じパックを使うには、先に相手（または自分がSeller
                  Center側）のスタンプをこの会話に含めてください。
                </p>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 sm:h-7 text-xs gap-1 min-h-[44px] sm:min-h-0 text-primary"
            >
              <Paperclip size={12} />
              添付
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="設定の翻訳エンジン（DeepL または Google）で、日本語↔英語を自動判別して翻訳します"
              disabled={translatingInput}
              onClick={() => void handleTranslateInput()}
              className="h-8 sm:h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary-subtle min-h-[44px] sm:min-h-0 hidden sm:flex"
            >
              {translatingInput ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Languages size={12} />
              )}
              {translatingInput ? "翻訳中…" : "DeepL翻訳"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 text-xs gap-1 sm:ml-auto min-h-[44px] sm:min-h-0 hidden sm:flex"
              onClick={async () => {
                const t = inputMessage.trim();
                if (!t) {
                  toast.error("コピーする内容がありません");
                  return;
                }
                try {
                  await navigator.clipboard.writeText(t);
                  toast.success("コピーしました");
                } catch {
                  toast.error("コピーに失敗しました");
                }
              }}
            >
              <Copy size={12} />
              コピー
            </Button>
          </div>

          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm"
                >
                  {file.type.startsWith('image/') ? (
                    <ImageIcon size={16} className="text-blue-600" />
                  ) : (
                    <File size={16} className="text-gray-600" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-gray-900 text-xs font-medium truncate max-w-[150px]">
                      {file.name}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              placeholder="メッセージを入力..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              disabled={sending}
              className="resize-none text-sm min-h-[72px] min-w-0 flex-1"
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!sending) void handleSend();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              aria-busy={sending}
              className="gradient-primary text-primary-foreground shadow-green self-end h-10 sm:h-10 px-4 min-h-[44px] flex-shrink-0 gap-2 disabled:opacity-60"
            >
              <Send size={14} />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs text-right hidden sm:block">
            Ctrl+Enter (⌘+Enter) で送信 | 画像・PDF・Word対応（最大10MB）
          </p>
        </div>
      </div>
    </div>
  );
}

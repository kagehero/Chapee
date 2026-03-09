"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Send, Languages, Package, Clock,
  ChevronDown, FileText, ShoppingBag, Copy, User, Info,
  Paperclip, Image as ImageIcon, File, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AttachedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

type Message = {
  id: number;
  sender: "customer" | "staff";
  content: string;
  time: string;
  translated: boolean;
  attachments?: AttachedFile[];
};

const mockMessages: Message[] = [
  { id: 1, sender: "customer", content: "こんにちは！注文した商品はいつ届きますか？", time: "10:00", translated: false },
  { id: 2, sender: "staff", content: "ご注文ありがとうございます。現在、発送準備中です。", time: "10:15", translated: false },
  { id: 3, sender: "customer", content: "追跡番号を教えていただけますか？", time: "11:30", translated: false },
  { id: 4, sender: "customer", content: "Please provide the tracking number as soon as possible.", time: "13:45", translated: false },
  { id: 5, sender: "customer", content: "I've been waiting for 3 days already.", time: "14:20", translated: false },
];

const templates = [
  { category: "発送前", items: ["発送準備中のご案内", "出荷完了のお知らせ", "追跡番号のご案内"] },
  { category: "配達後", items: ["受取確認のお願い", "レビューのお願い", "返品・交換案内"] },
  { category: "一般", items: ["お問い合わせへの返信", "謝罪文テンプレート", "営業時間外の自動返信"] },
];

const templateTexts: Record<string, string> = {
  "発送準備中のご案内": "この度はご注文いただきありがとうございます。現在、ご注文商品の発送準備を進めております。出荷後、追跡番号をお知らせいたします。",
  "追跡番号のご案内": "ご注文の商品が発送されました。追跡番号：[TRACKING_NUMBER] にてご確認いただけます。",
  "レビューのお願い": "この度はお買い上げいただきありがとうございます。商品はいかがでしたでしょうか？ぜひレビューをお寄せください。",
};

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const [messages, setMessages] = useState(mockMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [translating, setTranslating] = useState<number | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranslate = (msgId: number, content: string) => {
    setTranslating(msgId);
    setTimeout(() => {
      setTranslatedMessages(prev => ({
        ...prev,
        [msgId]: `[翻訳] ${content} → 「${content.length > 20 ? '長い英文のメッセージです...' : 'メッセージの翻訳結果'}」`,
      }));
      setTranslating(null);
    }, 1000);
  };

  const handleSend = () => {
    if (!inputMessage.trim() && attachedFiles.length === 0) return;
    
    const newMessage: Message = {
      id: messages.length + 1,
      sender: "staff",
      content: inputMessage,
      time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      translated: false,
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputMessage("");
    setAttachedFiles([]);
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

  const selectTemplate = (name: string) => {
    setInputMessage(templateTexts[name] || `[${name}] テンプレートの内容がここに入ります。`);
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

      <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center">
            <User size={14} className="text-primary-foreground" />
          </div>
          <div>
            <p className="text-foreground font-semibold text-sm">Lee Wei Ming</p>
            <p className="text-muted-foreground text-xs">SG顧客</p>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">国</span>
            <span className="font-semibold px-1.5 py-0.5 gradient-primary text-primary-foreground rounded text-xs">🇸🇬 SG</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">注文ID</span>
            <span className="text-foreground font-medium">#SG-2024-0892</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">担当者</span>
            <span className="text-foreground font-medium">田中</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">経過時間</span>
            <span className="text-destructive font-bold">11.5h</span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 gradient-primary rounded-lg flex items-center justify-center">
            <ShoppingBag size={12} className="text-primary-foreground" />
          </div>
          <p className="text-foreground font-semibold text-sm">注文情報</p>
        </div>
        <div className="bg-muted rounded-lg p-2.5">
          <p className="text-foreground text-xs font-medium">USB-C Hub 7-in-1</p>
          <p className="text-muted-foreground text-xs mt-0.5">数量: 1 | SGD 45.90</p>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Package size={11} className="text-primary" />
            <span className="text-muted-foreground">ステータス:</span>
            <span className="text-warning font-semibold">発送準備中</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-primary" />
            <span className="text-muted-foreground">注文日:</span>
            <span className="text-foreground">2024-01-15</span>
          </div>
        </div>
      </div>
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
            <MessageIcon />
            <p className="text-primary-foreground font-semibold text-sm truncate">Lee Wei Ming とのチャット</p>
          </div>
          <span className="text-primary-foreground/80 text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full shrink-0">
            🇸🇬 SG
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.sender === "staff" ? "justify-end" : "justify-start")}
            >
              <div className={cn(
                "max-w-[85%] sm:max-w-[75%] space-y-1",
                msg.sender === "staff" ? "items-end" : "items-start"
              )}>
                {/* Message text */}
                {msg.content && (
                  <div className={cn(
                    "rounded-xl px-3.5 py-2.5 text-sm shadow-sm",
                    msg.sender === "staff"
                      ? "gradient-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    {msg.content}
                  </div>
                )}

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="space-y-2">
                    {msg.attachments.map((file) => (
                      <div key={file.id}>
                        {file.type.startsWith('image/') ? (
                          // Image preview
                          <div className={cn(
                            "rounded-xl overflow-hidden shadow-md border-2 max-w-[300px]",
                            msg.sender === "staff" ? "border-primary" : "border-gray-200"
                          )}>
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(file.url, '_blank')}
                            />
                            <div className={cn(
                              "px-2 py-1.5 text-xs",
                              msg.sender === "staff" 
                                ? "bg-primary text-white" 
                                : "bg-gray-100 text-gray-700"
                            )}>
                              <div className="flex items-center gap-1.5">
                                <ImageIcon size={12} />
                                <span className="truncate flex-1">{file.name}</span>
                                <span className="text-xs opacity-75">{formatFileSize(file.size)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Document file
                          <div className={cn(
                            "rounded-xl px-3 py-2.5 shadow-sm border-2 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity",
                            msg.sender === "staff"
                              ? "gradient-primary text-primary-foreground border-primary"
                              : "bg-white text-gray-900 border-gray-200"
                          )}
                          onClick={() => window.open(file.url, '_blank')}
                          >
                            <File size={20} className={msg.sender === "staff" ? "text-white" : "text-gray-600"} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className={cn(
                                "text-xs",
                                msg.sender === "staff" ? "text-white/80" : "text-gray-500"
                              )}>
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <Paperclip size={16} className={msg.sender === "staff" ? "text-white/60" : "text-gray-400"} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {translatedMessages[msg.id] && (
                  <div className="bg-primary-subtle border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary">
                    {translatedMessages[msg.id]}
                  </div>
                )}

                <div className={cn(
                  "flex items-center gap-2",
                  msg.sender === "staff" ? "justify-end" : "justify-start"
                )}>
                  <span className="text-muted-foreground text-xs">{msg.time}</span>
                  {msg.sender === "customer" && (
                    <button
                      onClick={() => handleTranslate(msg.id, msg.content)}
                      className="text-xs text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
                      disabled={translating === msg.id}
                    >
                      <Languages size={11} />
                      {translating === msg.id ? "翻訳中..." : "翻訳"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Template Picker */}
        {showTemplates && (
          <div className="border-t border-border p-3 bg-muted/50 max-h-48 overflow-y-auto scrollbar-thin">
            <p className="text-xs font-semibold text-muted-foreground mb-2">テンプレート選択</p>
            <div className="space-y-2">
              {templates.map(({ category, items }) => (
                <div key={category}>
                  <p className="text-xs font-medium text-primary mb-1">{category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <button
                        key={item}
                        onClick={() => selectTemplate(item)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-card border border-border hover:border-primary hover:text-primary transition-all"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border p-3 space-y-2 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary-subtle min-h-[44px] sm:min-h-0"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <FileText size={12} />
              テンプレート
              <ChevronDown size={10} className={cn("transition-transform", showTemplates && "rotate-180")} />
            </Button>
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
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary-subtle min-h-[44px] sm:min-h-0 hidden sm:flex"
            >
              <Languages size={12} />
              DeepL翻訳
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-7 text-xs gap-1 sm:ml-auto min-h-[44px] sm:min-h-0 hidden sm:flex"
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
              className="resize-none text-sm min-h-[72px] min-w-0 flex-1"
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              className="gradient-primary text-primary-foreground shadow-green self-end h-10 sm:h-10 px-4 min-h-[44px] flex-shrink-0 gap-2"
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

function MessageIcon() {
  return (
    <div className="w-6 h-6 bg-primary-foreground/20 rounded-md flex items-center justify-center">
      <Send size={12} className="text-primary-foreground" />
    </div>
  );
}


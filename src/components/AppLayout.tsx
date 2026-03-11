"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  FileText,
  Zap,
  Users,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// Project assets from /public
const APP_ICON = "/icon.png";
const APP_LOGO = "/logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/dashboard" },
  { icon: MessageSquare, label: "チャット管理", path: "/chats" },
  { icon: FileText, label: "テンプレート", path: "/templates" },
  { icon: Zap, label: "自動返信設定", path: "/auto-reply" },
  { icon: Users, label: "担当者管理", path: "/staff" },
  { icon: Settings, label: "設定", path: "/settings" },
];

function SidebarContent({
  pathname,
  collapsed,
  onCollapsedToggle,
  onLogout,
  loggingOut,
  onNavClick,
}: {
  pathname: string | null;
  collapsed: boolean;
  onCollapsedToggle?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  onNavClick?: () => void;
}) {
  return (
    <>
      {/* Sidebar Header with Rounded Design */}
      <div className={cn("flex items-center gap-3 px-5 py-6", collapsed ? "justify-center px-2" : "")}>
        <button
          onClick={onCollapsedToggle}
          className="flex-shrink-0 w-10 h-10 bg-emerald-500/90 rounded-2xl flex items-center justify-center shadow-md border border-white/20 hover:bg-emerald-500 transition-colors cursor-pointer overflow-hidden"
          aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
        >
          <Image src={APP_ICON} alt="Chapee" width={24} height={24} className="object-contain" />
        </button>
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <p className="text-white font-bold text-base leading-tight truncate">Chapee</p>
            <p className="text-white/70 text-xs truncate">Chat Manager</p>
          </div>
        )}
        {onCollapsedToggle && !collapsed && (
          <button
            onClick={onCollapsedToggle}
            className="ml-auto text-white/70 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/10"
            aria-label="サイドバーを閉じる"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation with Modern Style */}
      <nav className={cn("flex-1 py-2 space-y-1.5 overflow-y-hidden", "px-3")}>
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || (path === "/dashboard" && pathname === "/");
          return (
            <Link
              key={path}
              href={path}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-2xl transition-all duration-200 group min-h-[48px] relative overflow-hidden",
                collapsed ? "justify-center px-3 py-3" : "px-4 py-3",
                active
                  ? "bg-white text-primary shadow-lg"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={20} className="flex-shrink-0 relative z-10" />
              {!collapsed && (
                <>
                  <span className="text-sm font-semibold animate-fade-in relative z-10">{label}</span>
                  {active && (
                    <div className="absolute right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section with Card Style */}
      <div className={cn("p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20", collapsed ? "m-2" : "m-2")}>
        <div className={cn("flex items-center gap-3 px-2 py-2", collapsed ? "justify-center px-0 mb-0" : "mb-2")}>
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/30">
            <span className="text-white text-sm font-bold">田</span>
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0">
              <p className="text-white text-sm font-semibold truncate">田中 太郎</p>
              <p className="text-white/60 text-xs truncate">管理者</p>
            </div>
          )}
        </div>
        {!collapsed ? (
          <button
            type="button"
            onClick={() => {
              onNavClick?.();
              onLogout();
            }}
            disabled={loggingOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all w-full text-left min-h-[44px]"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">{loggingOut ? "ログアウト中..." : "ログアウト"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onNavClick?.();
              onLogout();
            }}
            disabled={loggingOut}
            className="flex items-center justify-center mt-2 p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all w-full min-h-[44px]"
            aria-label="ログアウト"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMobileMenuOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Main Content with Modern Header */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Redesigned Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm gap-3 m-2 mb-0 ml-2 mr-0 md:mr-2 rounded-t-2xl md:rounded-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src={APP_ICON}
              alt="Chapee"
              width={32}
              height={32}
              className="flex-shrink-0 object-contain"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-emerald-700 font-bold text-base sm:text-lg leading-tight">
                Chapee
              </span>
              <span className="text-emerald-600/80 text-xs sm:text-sm leading-tight">
                Shopee Chat Manager
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="通知"
            >
              <Bell size={20} className="text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
            <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center hidden sm:flex shadow-md">
              <span className="text-white text-sm font-bold">田</span>
            </div>
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl hover:bg-gray-100 text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              aria-label="メニューを開く"
            >
              <Menu size={22} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto scrollbar-thin p-4 sm:p-6 pt-4 min-h-0 bg-transparent">
          {children}
        </main>
      </div>

      {/* Desktop Sidebar with Rounded Corners - Right Side */}
      <aside
        className={cn(
          "hidden md:flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 m-2 rounded-3xl overflow-hidden order-last",
          "gradient-sidebar shadow-green-lg",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent
          pathname={pathname}
          collapsed={collapsed}
          onCollapsedToggle={() => setCollapsed(!collapsed)}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </aside>

      {/* Mobile Menu Sheet - Right Side */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="right"
          className="w-[280px] max-w-[85vw] p-0 flex flex-col gradient-sidebar border-0 bg-transparent [&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:top-4 [&>button]:right-4"
        >
          <SheetTitle className="sr-only">メニュー</SheetTitle>
          <div className="flex flex-col h-full">
            <SidebarContent
              pathname={pathname}
              collapsed={false}
              onCollapsedToggle={undefined}
              onLogout={handleLogout}
              loggingOut={loggingOut}
              onNavClick={() => setMobileMenuOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

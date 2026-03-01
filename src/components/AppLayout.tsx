"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  FileText,
  Zap,
  Users,
  LogOut,
  ShoppingBag,
  Menu,
  X,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/dashboard" },
  { icon: MessageSquare, label: "チャット管理", path: "/chats" },
  { icon: FileText, label: "テンプレート", path: "/templates" },
  { icon: Zap, label: "自動返信設定", path: "/auto-reply" },
  { icon: Users, label: "担当者管理", path: "/staff" },
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
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex-shrink-0 w-9 h-9 gradient-primary rounded-lg flex items-center justify-center shadow-md">
          <ShoppingBag size={18} className="text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <p className="text-sidebar-foreground font-bold text-sm leading-tight truncate">Shopee</p>
            <p className="text-sidebar-foreground/70 text-xs truncate">チャット管理</p>
          </div>
        )}
        {onCollapsedToggle && (
          <button
            onClick={onCollapsedToggle}
            className="ml-auto text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1 rounded"
            aria-label={collapsed ? "メニューを開く" : "サイドバーを閉じる"}
          >
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || (path === "/dashboard" && pathname === "/");
          return (
            <Link
              key={path}
              href={path}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group min-h-[44px]",
                active
                  ? "bg-sidebar-foreground/20 text-sidebar-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-sm font-medium animate-fade-in">{label}</span>
                  {active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-foreground" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1", collapsed ? "justify-center" : "")}>
          <div className="w-8 h-8 rounded-full bg-sidebar-foreground/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sidebar-foreground text-xs font-bold">田</span>
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0">
              <p className="text-sidebar-foreground text-xs font-semibold truncate">田中 太郎</p>
              <p className="text-sidebar-foreground/60 text-xs truncate">管理者</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onNavClick?.();
            onLogout();
          }}
          disabled={loggingOut}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 transition-all w-full text-left min-h-[44px]",
            collapsed ? "justify-center" : ""
          )}
        >
          <LogOut size={16} />
          {!collapsed && (
            <span className="text-xs font-medium">{loggingOut ? "ログアウト中..." : "ログアウト"}</span>
          )}
        </button>
      </div>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside
        className={cn(
          "hidden md:flex flex-col transition-all duration-300 ease-in-out flex-shrink-0",
          "gradient-sidebar shadow-purple-lg",
          collapsed ? "w-16" : "w-60"
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

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[280px] max-w-[85vw] p-0 flex flex-col gradient-sidebar border-sidebar-border bg-transparent [&>button]:text-primary-foreground [&>button]:hover:bg-primary-foreground/10 [&>button]:top-3 [&>button]:right-3"
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-card border-b border-border px-3 sm:px-6 py-3 flex items-center justify-between shadow-card gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg hover:bg-muted text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="メニューを開く"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-foreground font-semibold text-sm sm:text-base truncate">
              {navItems.find(n => (pathname ?? "").startsWith(n.path))?.label ?? "ダッシュボード"}
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              className="relative p-2 rounded-lg hover:bg-primary-subtle transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="通知"
            >
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
            </button>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center hidden sm:flex">
              <span className="text-primary-foreground text-xs font-bold">田</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-thin p-4 sm:p-6 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}

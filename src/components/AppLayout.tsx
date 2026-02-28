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

const navItems = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/dashboard" },
  { icon: MessageSquare, label: "チャット管理", path: "/chats" },
  { icon: FileText, label: "テンプレート", path: "/templates" },
  { icon: Zap, label: "自動返信設定", path: "/auto-reply" },
  { icon: Users, label: "担当者管理", path: "/staff" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
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
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          "gradient-sidebar shadow-purple-lg",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex-shrink-0 w-9 h-9 gradient-primary rounded-lg flex items-center justify-center shadow-md">
            <ShoppingBag size={18} className="text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <p className="text-sidebar-foreground font-bold text-sm leading-tight">Shopee</p>
              <p className="text-sidebar-foreground/70 text-xs">チャット管理</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = pathname === path || (path === "/dashboard" && pathname === "/");
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  active
                    ? "bg-sidebar-foreground/20 text-sidebar-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                )}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium animate-fade-in">{label}</span>
                )}
                {active && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1",
            collapsed ? "justify-center" : ""
          )}>
            <div className="w-8 h-8 rounded-full bg-sidebar-foreground/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sidebar-foreground text-xs font-bold">田</span>
            </div>
            {!collapsed && (
              <div className="animate-fade-in">
                <p className="text-sidebar-foreground text-xs font-semibold">田中 太郎</p>
                <p className="text-sidebar-foreground/60 text-xs">管理者</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 transition-all w-full text-left",
              collapsed ? "justify-center" : ""
            )}
          >
            <LogOut size={16} />
            {!collapsed && (
              <span className="text-xs font-medium">{loggingOut ? "ログアウト中..." : "ログアウト"}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between shadow-card">
          <div>
            <h1 className="text-foreground font-semibold text-base">
              {navItems.find(n => (pathname ?? "").startsWith(n.path))?.label ?? "ダッシュボード"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-primary-subtle transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive"></span>
            </button>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">田</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto scrollbar-thin p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

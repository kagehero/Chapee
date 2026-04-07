"use client";

import Image from "next/image";
import { SHOPEE_MARKET_CODES } from "@/lib/shopee-markets";

const APP_ICON = "/icon.png";

export default function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-primary-foreground/5 translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-primary-foreground/5 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-primary-foreground/30 flex items-center justify-center shadow-md backdrop-blur-sm overflow-hidden">
              <Image
                src={APP_ICON}
                alt="Chapee"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div className="text-left">
              <h1 className="text-primary-foreground text-3xl font-bold leading-tight">Chapee</h1>
              <p className="text-primary-foreground/90 text-sm leading-tight">Shopee Chat Manager</p>
            </div>
          </div>
          <p className="text-primary-foreground/80 text-base max-w-sm mx-auto leading-relaxed">
            多店舗・多国対応のチャット管理プラットフォーム
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {SHOPEE_MARKET_CODES.map((country) => (
              <div
                key={country}
                className="bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/20 rounded-xl p-3 text-primary-foreground text-sm font-medium"
              >
                {country}
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-xl px-4 py-3 text-primary-foreground">
              <p className="text-sm font-semibold mb-1"> 期限厳守の自動応答機能</p>
              <p className="text-xs text-primary-foreground/70">返信期限を逃さない安心設計</p>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-xl px-4 py-3 text-primary-foreground">
              <p className="text-sm font-semibold mb-1"> メイン・サブアカウント対応</p>
              <p className="text-xs text-primary-foreground/70">複数アカウントの一元管理</p>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-xl px-4 py-3 text-primary-foreground">
              <p className="text-sm font-semibold mb-1"> 7か国対応（SG/PH/MY/TW/TH/VN/BR）</p>
              <p className="text-xs text-primary-foreground/70">グローバル展開をサポート</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-4">
          <div className="lg:hidden flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/90 flex items-center justify-center shadow-green overflow-hidden">
              <Image
                src={APP_ICON}
                alt="Chapee"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-foreground font-bold text-xl">Chapee</h1>
              <p className="text-muted-foreground text-xs">Shopee Chat Manager</p>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <h2 className="text-foreground text-xl sm:text-2xl font-bold mb-1">{title}</h2>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>

          {children}

          <p className="text-center text-muted-foreground text-xs mt-6">
            © {new Date().getFullYear()} Chapee. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

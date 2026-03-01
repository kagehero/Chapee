"use client";

import { ShoppingBag } from "lucide-react";

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
          <div className="w-20 h-20 bg-primary-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-primary-foreground/20">
            <ShoppingBag size={40} className="text-primary-foreground" />
          </div>
          <h1 className="text-primary-foreground text-3xl font-bold mb-3">Shopee Chat Manager</h1>
          <p className="text-primary-foreground/80 text-base max-w-sm mx-auto leading-relaxed">
            多店舗・多国対応のチャット管理プラットフォーム
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {["🇸🇬 SG", "🇵🇭 PH", "🇲🇾 MY"].map((country) => (
              <div
                key={country}
                className="bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/20 rounded-xl p-3 text-primary-foreground text-sm font-medium"
              >
                {country}
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-primary-foreground/70 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">98%</p>
              <p className="text-xs">応答率</p>
            </div>
            <div className="w-px h-8 bg-primary-foreground/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">3h</p>
              <p className="text-xs">平均応答時間</p>
            </div>
            <div className="w-px h-8 bg-primary-foreground/20" />
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">5ヶ国</p>
              <p className="text-xs">対応可能</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-4">
          <div className="lg:hidden flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-purple">
              <ShoppingBag size={20} className="text-primary-foreground" />
            </div>
            <h1 className="text-foreground font-bold text-xl">Shopee Chat Manager</h1>
          </div>

          <div className="mb-6 sm:mb-8">
            <h2 className="text-foreground text-xl sm:text-2xl font-bold mb-1">{title}</h2>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>

          {children}

          <p className="text-center text-muted-foreground text-xs mt-6">
            © {new Date().getFullYear()} Shopee Chat Manager. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

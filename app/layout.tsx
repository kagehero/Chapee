import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Shopee Chat Manager",
  description: "Multi-country chat management dashboard for Shopee-style stores",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


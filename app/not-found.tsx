"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4 sm:p-6">
      <div className="text-center max-w-sm w-full">
        <h1 className="mb-4 text-3xl sm:text-4xl font-bold">404</h1>
        <p className="mb-6 text-base sm:text-xl text-muted-foreground">Oops! Page not found</p>
        <a
          href="/"
          className="inline-block text-primary underline hover:text-primary/90 font-medium min-h-[44px] leading-[44px]"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}


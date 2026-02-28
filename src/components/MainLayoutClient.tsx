"use client";

import type { ReactNode } from "react";
import AppLayout from "@/components/AppLayout";

export default function MainLayoutClient({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

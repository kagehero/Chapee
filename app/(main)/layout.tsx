import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as jose from "jose";
import MainLayoutClient from "@/components/MainLayoutClient";

const COOKIE_NAME = "auth-token";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET || "please-change-this-secret-key"
  );

  try {
    await jose.jwtVerify(token, secret);
  } catch {
    redirect("/login");
  }

  return <MainLayoutClient>{children}</MainLayoutClient>;
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

/** トップ: 有効なセッションならダッシュボードへ、なければログインへ（再接続時は再ログイン不要） */
export default async function RootPage() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (session.valid) redirect("/dashboard");
  redirect("/login");
}


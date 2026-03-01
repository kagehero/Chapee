import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

/** 有効なセッション（Cookie）があればダッシュボードへ。再接続時は再ログイン不要。 */
export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (session.valid) redirect("/dashboard");
  return <LoginForm />;
}

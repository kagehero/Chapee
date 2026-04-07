import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import { shopeeOAuthReturnQuery } from "@/lib/shopee-oauth-return";

/** 有効なセッション（Cookie）があればダッシュボードへ。再接続時は再ログイン不要。 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const oauthSuffix = shopeeOAuthReturnQuery(sp);

  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (session.valid) redirect(`/dashboard${oauthSuffix}`);
  return <LoginForm />;
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { shopeeOAuthReturnQuery } from "@/lib/shopee-oauth-return";

/** トップ: 有効なセッションならダッシュボードへ、なければログインへ（再接続時は再ログイン不要） */
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const oauthSuffix = shopeeOAuthReturnQuery(sp);

  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (session.valid) redirect(`/dashboard${oauthSuffix}`);
  redirect(`/login${oauthSuffix}`);
}


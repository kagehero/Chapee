import * as jose from "jose";

export const COOKIE_NAME = "auth-token";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET || "please-change-this-secret-key"
  );

/** Cookieストア（Next.js の cookies() の戻り値） */
type CookieStore = { get: (name: string) => { value: string } | undefined };

/**
 * サーバー側でCookieのauth-tokenを検証し、有効なセッションかどうかを返す。
 * 再接続時やトップ/ログイン訪問時に、ログイン不要でダッシュボードへ遷移するために使用する。
 */
export async function getSession(
  cookieStore: CookieStore
): Promise<{ valid: true; email: string; name?: string } | { valid: false }> {
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { valid: false };

  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    const sub = payload.sub;
    const name = payload.name as string | undefined;
    if (typeof sub !== "string") return { valid: false };
    return { valid: true, email: sub, name };
  } catch {
    return { valid: false };
  }
}

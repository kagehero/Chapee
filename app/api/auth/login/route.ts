import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import * as jose from "jose";
import { getCollection } from "@/lib/mongodb";

const COOKIE_NAME = "auth-token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const col = await getCollection<{
      email: string;
      password: string;
      name: string;
    }>("users");

    const user = await col.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET || "please-change-this-secret-key"
    );
    const token = await new jose.SignJWT({
      sub: user.email,
      name: user.name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getCollection } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "名前・メールアドレス・パスワードは必須です" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上にしてください" },
        { status: 400 }
      );
    }

    const col = await getCollection<{
      email: string;
      password: string;
      name: string;
      createdAt: Date;
    }>("users");

    const existing = await col.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await col.insertOne({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "登録に失敗しました" },
      { status: 500 }
    );
  }
}

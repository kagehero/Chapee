import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/translate — DeepL（サーバー側キー）
 * Body: { text: string, target_lang?: string }  target_lang 省略時は JA
 */
export async function POST(request: NextRequest) {
  try {
    const key = process.env.DEEPL_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "DeepL API キーが設定されていません（DEEPL_API_KEY）" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text が空です" }, { status: 400 });
    }

    const targetLang = String(body.target_lang ?? "JA").toUpperCase();
    const baseUrl = (
      process.env.DEEPL_API_URL || "https://api-free.deepl.com"
    ).replace(/\/$/, "");

    const res = await fetch(`${baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("DeepL translate error:", res.status, errText);
      return NextResponse.json(
        { error: "翻訳サービスに接続できませんでした" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      translations?: { text: string }[];
    };
    const translated = data.translations?.[0]?.text?.trim();
    if (!translated) {
      return NextResponse.json({ error: "翻訳結果が空です" }, { status: 502 });
    }

    return NextResponse.json({ text: translated });
  } catch (error) {
    console.error("POST /api/translate:", error);
    return NextResponse.json({ error: "翻訳に失敗しました" }, { status: 500 });
  }
}

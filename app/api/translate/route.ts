import { NextRequest, NextResponse } from "next/server";
import { resolveTranslateCredentials } from "@/lib/translation-settings";
import { inferTargetLangJaEnSwap } from "@/lib/ja-en-translate-detect";

/**
 * POST /api/translate
 * Body: { text: string, target_lang?: string }
 * - target_lang 省略 / "auto" / "AUTO" … 日本語⇔英語を自動（日本語多め→英語へ、英語多め→日本語へ）
 * - target_lang を明示 … その言語へ訳す（従来どおり）
 * エンジンは設定画面の「メッセージ履歴の翻訳」に従う（DeepL / Google）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text が空です" }, { status: 400 });
    }

    const raw = body.target_lang;
    const auto =
      raw == null ||
      raw === "" ||
      String(raw).toLowerCase() === "auto";
    const targetRaw = auto
      ? inferTargetLangJaEnSwap(text)
      : String(raw);
    const { history_provider, deeplKey, googleKey } =
      await resolveTranslateCredentials();

    let translated: string;

    if (history_provider === "google") {
      if (!googleKey) {
        return NextResponse.json(
          {
            error:
              "Google 翻訳の API キーが未設定です。設定でキーを保存するか、GOOGLE_TRANSLATE_API_KEY を環境変数に設定してください。",
          },
          { status: 503 }
        );
      }
      translated = await translateGoogle(text, targetRaw, googleKey);
    } else {
      if (!deeplKey) {
        return NextResponse.json(
          {
            error:
              "DeepL API キーが未設定です。設定でキーを保存するか、DEEPL_API_KEY を環境変数に設定してください。",
          },
          { status: 503 }
        );
      }
      translated = await translateDeepL(text, targetRaw, deeplKey);
    }

    if (!translated) {
      return NextResponse.json({ error: "翻訳結果が空です" }, { status: 502 });
    }

    const targetNorm = targetRaw.toUpperCase().split(/[-_]/)[0];
    return NextResponse.json({
      text: translated,
      target_lang: targetNorm === "JA" || targetNorm === "EN" ? targetNorm : targetRaw,
    });
  } catch (error) {
    console.error("POST /api/translate:", error);
    const msg =
      error instanceof Error ? error.message : "翻訳に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function translateDeepL(
  text: string,
  targetLang: string,
  key: string
): Promise<string> {
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
      /** DeepL は EN ではなく EN-US / EN-GB 等が必要なため */
      target_lang:
        targetLang.toUpperCase() === "EN" ? "EN-US" : targetLang.toUpperCase(),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("DeepL translate error:", res.status, errText);
    throw new Error("翻訳サービスに接続できませんでした");
  }

  const data = (await res.json()) as {
    translations?: { text: string }[];
  };
  return data.translations?.[0]?.text?.trim() ?? "";
}

async function translateGoogle(
  text: string,
  targetLang: string,
  apiKey: string
): Promise<string> {
  const target = targetLang.toLowerCase().replace("_", "-").split("-")[0];
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      target,
      format: "text",
    }),
  });

  const data = (await res.json()) as {
    data?: { translations?: { translatedText: string }[] };
    error?: { message?: string; errors?: { message: string }[] };
  };

  const errMsg =
    data.error?.message ||
    data.error?.errors?.[0]?.message ||
    (!res.ok ? `HTTP ${res.status}` : null);
  if (errMsg) {
    console.error("Google Translate error:", data.error ?? res.status);
    throw new Error(errMsg);
  }

  return data.data?.translations?.[0]?.translatedText?.trim() ?? "";
}

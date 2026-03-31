import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";
import {
  getTranslationSettings,
  maskApiKey,
  type TranslationProvider,
  type TranslationSettingsDoc,
} from "@/lib/translation-settings";

const COL = "translation_settings";
const SINGLETON_ID = "singleton" as const;

async function requireSession() {
  const cookieStore = await cookies();
  return getSession(cookieStore);
}

async function fetchDeepLUsage(apiKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v2/usage`, {
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    character_count?: number;
    character_limit?: number;
  };
  return {
    character_count: data.character_count ?? 0,
    character_limit: data.character_limit ?? 0,
  };
}

export async function GET() {
  const session = await requireSession();
  if (!session.valid) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const doc = await getTranslationSettings();
  const deeplKey =
    doc?.deepl_api_key?.trim() || process.env.DEEPL_API_KEY?.trim() || "";
  const googleKey =
    doc?.google_api_key?.trim() ||
    process.env.GOOGLE_TRANSLATE_API_KEY?.trim() ||
    "";

  const baseUrl = (
    process.env.DEEPL_API_URL || "https://api-free.deepl.com"
  ).replace(/\/$/, "");

  let deepl_usage: {
    character_count: number;
    character_limit: number;
  } | null = null;
  if (deeplKey) {
    deepl_usage = await fetchDeepLUsage(deeplKey, baseUrl);
  }

  return NextResponse.json({
    history_provider: doc?.history_provider ?? "deepl",
    input_provider: doc?.input_provider ?? "deepl",
    deepl_key_configured: Boolean(doc?.deepl_api_key?.trim()),
    google_key_configured: Boolean(doc?.google_api_key?.trim()),
    env_deepl_fallback: Boolean(
      !doc?.deepl_api_key?.trim() && process.env.DEEPL_API_KEY?.trim()
    ),
    env_google_fallback: Boolean(
      !doc?.google_api_key?.trim() &&
        process.env.GOOGLE_TRANSLATE_API_KEY?.trim()
    ),
    deepl_key_masked: maskApiKey(doc?.deepl_api_key ?? null),
    google_key_masked: maskApiKey(doc?.google_api_key ?? null),
    deepl_usage,
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireSession();
  if (!session.valid) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const history_provider = body.history_provider as TranslationProvider;
    const input_provider = body.input_provider as TranslationProvider;

    if (
      history_provider !== "deepl" &&
      history_provider !== "google"
    ) {
      return NextResponse.json(
        { error: "history_provider が不正です" },
        { status: 400 }
      );
    }
    if (input_provider !== "deepl" && input_provider !== "google") {
      return NextResponse.json(
        { error: "input_provider が不正です" },
        { status: 400 }
      );
    }

    const col = await getCollection<TranslationSettingsDoc>(COL);

    const set: Partial<TranslationSettingsDoc> = {
      history_provider,
      input_provider,
      updated_at: new Date(),
    };

    const deeplIn = typeof body.deepl_api_key === "string" ? body.deepl_api_key.trim() : "";
    const googleIn = typeof body.google_api_key === "string" ? body.google_api_key.trim() : "";

    if (body.clear_deepl === true) set.deepl_api_key = null;
    else if (deeplIn) set.deepl_api_key = deeplIn;

    if (body.clear_google === true) set.google_api_key = null;
    else if (googleIn) set.google_api_key = googleIn;

    await col.updateOne(
      { _id: SINGLETON_ID },
      {
        $set: set,
        $setOnInsert: {
          _id: SINGLETON_ID,
          deepl_api_key: null,
          google_api_key: null,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PUT /api/settings/translation:", e);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

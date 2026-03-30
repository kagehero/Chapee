import { getCollection } from "@/lib/mongodb";

export type TranslationProvider = "deepl" | "google";

export type TranslationSettingsDoc = {
  _id: "singleton";
  history_provider: TranslationProvider;
  input_provider: TranslationProvider;
  deepl_api_key: string | null;
  google_api_key: string | null;
  updated_at: Date;
};

const COL = "translation_settings";
const SINGLETON_ID = "singleton" as const;

export async function getTranslationSettings(): Promise<TranslationSettingsDoc | null> {
  const col = await getCollection<TranslationSettingsDoc>(COL);
  return col.findOne({ _id: SINGLETON_ID });
}

/** Keys: DB first, then env fallbacks */
export async function resolveTranslateCredentials(): Promise<{
  history_provider: TranslationProvider;
  deeplKey: string | null;
  googleKey: string | null;
}> {
  const s = await getTranslationSettings();
  const deeplKey =
    s?.deepl_api_key?.trim() || process.env.DEEPL_API_KEY?.trim() || null;
  const googleKey =
    s?.google_api_key?.trim() ||
    process.env.GOOGLE_TRANSLATE_API_KEY?.trim() ||
    null;
  const history = s?.history_provider ?? "deepl";
  return {
    history_provider: history,
    deeplKey,
    googleKey,
  };
}

export function maskApiKey(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  const k = key.trim();
  if (k.length <= 4) return "****";
  return `••••${k.slice(-4)}`;
}

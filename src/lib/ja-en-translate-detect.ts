/**
 * 入力テキストが主に日本語かラテン（英語）かを見て、
 * 日本語 → 英語、英語 → 日本語 になるよう翻訳先言語コードを返す。
 */
export function inferTargetLangJaEnSwap(text: string): "JA" | "EN" {
  const t = text.trim();
  if (!t) return "EN";

  let jp = 0;
  let latin = 0;
  for (const ch of t) {
    const cp = ch.codePointAt(0)!;
    if (
      (cp >= 0x3040 && cp <= 0x309f) ||
      (cp >= 0x30a0 && cp <= 0x30ff) ||
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf)
    ) {
      jp += 1;
    } else if (
      (cp >= 0x41 && cp <= 0x5a) ||
      (cp >= 0x61 && cp <= 0x7a)
    ) {
      latin += 1;
    }
  }

  if (jp === 0 && latin === 0) {
    return /[\u3040-\u30ff\u4e00-\u9fff]/.test(t) ? "EN" : "JA";
  }

  if (jp >= latin) return "EN";
  return "JA";
}

export type MeaningFields = {
  definition: string;
  short_definition?: string | null;
  localized_definition?: string | null;
  localized_short_definition?: string | null;
};

const HANGUL_TOKEN = /[\uAC00-\uD7A3]+/g;
const KOREAN_COMMA_LIST = /^[\uAC00-\uD7A3]+(?:\s*,\s*[\uAC00-\uD7A3]+)+$/;

function trimMeaning(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/[.。]+$/u, '').trim() || null : null;
}

function hangulTokens(text: string): string[] {
  return text.match(HANGUL_TOKEN) ?? [];
}

export function isSimpleGloss(text: string | null | undefined): boolean {
  const value = trimMeaning(text);
  if (!value) return false;

  const korean = hangulTokens(value);
  if (korean.length === 1) return true;
  if (korean.length > 1) {
    return korean.length <= 3 && KOREAN_COMMA_LIST.test(value);
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (/^to\s+/i.test(value)) return false;
  return true;
}

export function extractKoreanHeadword(text: string | null | undefined): string | null {
  const value = trimMeaning(text);
  if (!value) return null;
  const tokens = hangulTokens(value);
  if (tokens.length === 0) return null;
  return tokens[tokens.length - 1] ?? null;
}

export function preferSimpleGloss(
  shortText: string | null | undefined,
  fullText: string | null | undefined,
): string | null {
  const shortValue = trimMeaning(shortText);
  if (shortValue && isSimpleGloss(shortValue)) return shortValue;

  const fullValue = trimMeaning(fullText);
  if (fullValue && isSimpleGloss(fullValue)) return fullValue;

  const extracted = extractKoreanHeadword(shortValue ?? fullValue);
  if (extracted) return extracted;

  const english = simplifyEnglishGloss(shortValue ?? fullValue);
  if (english) return english;

  return shortValue ?? fullValue;
}

function simplifyEnglishGloss(text: string | null): string | null {
  if (!text || isSimpleGloss(text)) return text;
  const toMatch = text.match(/^to\s+([a-z]+)/i);
  if (toMatch?.[1]) return toMatch[1].toLowerCase();
  return null;
}

export function uniqueText(
  value: string | null | undefined,
  original: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed === original?.trim()) return null;
  return trimmed;
}

/**
 * Single display gloss for Select Words, flashcard back, and word detail.
 * Prefers localized_short_definition → localized_definition → short_definition → definition.
 */
export function displayGloss(item: MeaningFields): string | null {
  const localized = preferSimpleGloss(item.localized_short_definition, item.localized_definition);
  if (localized) return localized;

  const english = preferSimpleGloss(item.short_definition, item.definition);
  if (english) return english;

  return (
    trimMeaning(item.localized_short_definition) ??
    trimMeaning(item.localized_definition) ??
    trimMeaning(item.short_definition) ??
    trimMeaning(item.definition)
  );
}

/** Display helpers: simple gloss only (full is unused / always null). */
export function splitMeanings(item: MeaningFields): { simple: string | null; full: string | null } {
  return { simple: displayGloss(item), full: null };
}

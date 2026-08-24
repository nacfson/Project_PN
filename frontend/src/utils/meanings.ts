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

/** Simple headword (덮다) plus the current dictionary meaning, with no duplicates. */
export function splitMeanings(item: MeaningFields): { simple: string | null; full: string | null } {
  const full = uniqueText(item.localized_definition, item.definition);
  const localizedSimple = uniqueText(
    preferSimpleGloss(item.localized_short_definition, item.localized_definition),
    item.definition,
  );
  const englishSimple = uniqueText(
    preferSimpleGloss(item.short_definition, item.definition),
    item.definition,
  );
  const simple = localizedSimple ?? englishSimple;

  if (simple && full && simple === full) {
    return { simple, full: null };
  }
  return { simple, full };
}

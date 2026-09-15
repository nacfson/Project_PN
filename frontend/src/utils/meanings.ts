export type MeaningFields = {
  personal_note?: string | null;
  definition: string;
  short_definition?: string | null;
  localized_definition?: string | null;
  localized_short_definition?: string | null;
};

const HANGUL_TOKEN = /[\uAC00-\uD7A3]+/g;
const KOREAN_COMMA_LIST = /^[\uAC00-\uD7A3]+(?:\s*,\s*[\uAC00-\uD7A3]+)+$/;

/** Nominalizers / connectives that are never useful Select Words glosses. */
const KOREAN_GLOSS_STOPWORDS = new Set([
  '것',
  '수',
  '등',
  '등등',
  '및',
  '또는',
  '혹은',
  '그리고',
  '또',
  '더',
  '임',
  '음',
  '듯',
  '바',
  '데',
]);

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
  if (korean.length === 1) {
    return !KOREAN_GLOSS_STOPWORDS.has(korean[0]!);
  }
  if (korean.length > 1) {
    return korean.length <= 3 && KOREAN_COMMA_LIST.test(value);
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (/^to\s+/i.test(value)) return false;
  return true;
}

/** Turn attributive forms into dictionary lemmas when obvious (공급하는 → 공급하다). */
export function normalizeKoreanPredicate(token: string): string {
  const t = token.trim();
  if (t.length < 2) return t;
  if (t.endsWith('하는') && t.length > 2) return `${t.slice(0, -2)}하다`;
  if (t.endsWith('되는') && t.length > 2) return `${t.slice(0, -2)}되다`;
  if (t.endsWith('이는') && t.length > 2) return `${t.slice(0, -2)}이다`;
  return t;
}

function isPreferredVerbLemma(token: string): boolean {
  return /(?:하다|되다|이다)$/u.test(token);
}

function isVerbLike(token: string): boolean {
  return /다$/u.test(token) || /(?:하는|되는|이는)$/u.test(token);
}

/**
 * Pick a Select Words headword from a dictionary paraphrase.
 * Skips hollow endings like 것, and prefers real verb lemmas (…하다) over the last token.
 */
export function extractKoreanHeadword(text: string | null | undefined): string | null {
  const value = trimMeaning(text);
  if (!value) return null;
  const tokens = hangulTokens(value)
    .map(normalizeKoreanPredicate)
    .filter((t) => t.length > 0 && !KOREAN_GLOSS_STOPWORDS.has(t));
  if (tokens.length === 0) return null;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (isPreferredVerbLemma(t)) return t;
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (isVerbLike(t)) return normalizeKoreanPredicate(t);
  }
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
 * Prefers personal_note → localized_short_definition → localized_definition → short_definition → definition.
 */
export function displayGloss(item: MeaningFields): string | null {
  const note = item.personal_note?.trim();
  if (note) return note;

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

import * as Localization from 'expo-localization';

/**
 * Returns the device's primary language code as a lowercase ISO 639-1 string.
 * Examples: 'en-US' -> 'en', 'ko-KR' -> 'ko', 'ja-JP' -> 'ja'.
 */
export function getDeviceLanguageCode(): string {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageCode ?? '';
  return tag.toLowerCase().split('-')[0];
}

import { Platform } from 'react-native';
import { FontDisplay, type FontSource } from 'expo-font';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from '@expo-google-fonts/geist';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import {
  IBMPlexSansKR_400Regular,
  IBMPlexSansKR_500Medium,
  IBMPlexSansKR_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-kr';

export type FontRole = 'ui' | 'display' | 'mono';
export type FontWeightName = 'regular' | 'medium' | 'semibold';

export const fontFamilies = {
  ui: 'Geist-Regular',
  uiMedium: 'Geist-Medium',
  uiSemibold: 'Geist-SemiBold',
  display: 'Newsreader-Regular',
  displayMedium: 'Newsreader-Medium',
  mono: 'GeistMono-Regular',
  korean: 'IBMPlexSansKR-Regular',
  koreanMedium: 'IBMPlexSansKR-Medium',
  koreanSemibold: 'IBMPlexSansKR-SemiBold',
} as const;

export const webFontStacks: Record<FontRole, string> = {
  ui: "'Nunito', 'IBMPlexSansKR-Regular', 'IBM Plex Sans KR', 'Geist-Regular', system-ui, -apple-system, sans-serif",
  display: "'Fredoka', 'Nunito', 'IBMPlexSansKR-SemiBold', 'IBM Plex Sans KR', system-ui, sans-serif",
  mono: "'Roboto Mono', 'GeistMono-Regular', 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

function withSwap(source: FontSource): FontSource {
  if (Platform.OS === 'web' && typeof source !== 'object') {
    return { uri: source as unknown as string, display: FontDisplay.SWAP };
  }
  return source;
}

export const fontAssets: Record<string, FontSource> = {
  [fontFamilies.ui]: withSwap(Geist_400Regular),
  [fontFamilies.uiMedium]: withSwap(Geist_500Medium),
  [fontFamilies.uiSemibold]: withSwap(Geist_600SemiBold),
  [fontFamilies.display]: withSwap(Newsreader_400Regular),
  [fontFamilies.displayMedium]: withSwap(Newsreader_500Medium),
  [fontFamilies.mono]: withSwap(GeistMono_400Regular),
  [fontFamilies.korean]: withSwap(IBMPlexSansKR_400Regular),
  [fontFamilies.koreanMedium]: withSwap(IBMPlexSansKR_500Medium),
  [fontFamilies.koreanSemibold]: withSwap(IBMPlexSansKR_600SemiBold),
};

const HANGUL_REGEX = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;

export function containsHangul(text?: string | null): boolean {
  if (!text) return false;
  return HANGUL_REGEX.test(text);
}

export function fontFamilyFor(
  role: FontRole = 'ui',
  weight: FontWeightName = 'regular',
  options?: { text?: string; lang?: 'ko' },
): string {
  const useKorean = options?.lang === 'ko' || containsHangul(options?.text);

  if (Platform.OS === 'web') {
    if (role === 'mono') {
      return webFontStacks.mono;
    }
    if (role === 'display' && !useKorean) {
      return webFontStacks.display;
    }
    if (useKorean) {
      const primaryKo =
        weight === 'semibold'
          ? fontFamilies.koreanSemibold
          : weight === 'medium'
            ? fontFamilies.koreanMedium
            : fontFamilies.korean;
      return `'${primaryKo}', 'IBM Plex Sans KR', ${webFontStacks.ui}`;
    }
    return webFontStacks.ui;
  }

  if (role === 'mono') {
    return fontFamilies.mono;
  }

  if (role === 'display') {
    return weight === 'medium' || weight === 'semibold'
      ? fontFamilies.displayMedium
      : fontFamilies.display;
  }

  if (useKorean) {
    if (weight === 'semibold') return fontFamilies.koreanSemibold;
    if (weight === 'medium') return fontFamilies.koreanMedium;
    return fontFamilies.korean;
  }

  if (weight === 'semibold') return fontFamilies.uiSemibold;
  if (weight === 'medium') return fontFamilies.uiMedium;
  return fontFamilies.ui;
}

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API base URL resolution per platform.
// - EXPO_PUBLIC_API_BASE_URL always wins and should be set for native/Tauri builds.
// - hosted web builds default to their own origin so a reverse proxy can serve
//   the app and API from the same public host.
// - local dev keeps localhost/emulator defaults.
const DEFAULT_PORT = 8080;

function browserOrigin(): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  return window.location.origin;
}

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  } catch {
    return false;
  }
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  const origin = browserOrigin();
  if (Platform.OS === 'web' && origin && !isLocalOrigin(origin)) {
    return origin;
  }

  // Detect the packager/bundler host IP in development
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${DEFAULT_PORT}`;
    }
  }

  // Release/native must never fall back to localhost (unreachable on device).
  // Proven failure mode: Xcode embed without EXPO_PUBLIC_* → Platform.select localhost:8080.
  if (!__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'android')) {
    return 'https://pn.nacfson.cloud';
  }

  return Platform.select({
    web: `http://localhost:${DEFAULT_PORT}`,
    ios: `http://localhost:${DEFAULT_PORT}`,
    android: `http://10.0.2.2:${DEFAULT_PORT}`,
    default: `http://localhost:${DEFAULT_PORT}`,
  }) as string;
}

function resolveApiFallbackUrls(): string[] {
  const fallbackEnv = process.env.EXPO_PUBLIC_API_FALLBACK_URLS as string | undefined;
  if (!fallbackEnv || fallbackEnv.length === 0) {
    return [];
  }

  return fallbackEnv
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveCentralAuthUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_CENTRAL_AUTH_URL;
  return fromEnv ? stripTrailingSlash(fromEnv.trim()) : '';
}

export const API_BASE_URL = resolveApiBaseUrl();
// Production builds use a single URL (https://pn.nacfson.cloud). Intranet vs
// public is handled by split DNS, not client fallbacks. Fallbacks are local-dev only.
export const API_BASE_URLS = [
  API_BASE_URL,
  ...(__DEV__ ? resolveApiFallbackUrls().filter((url) => url !== API_BASE_URL) : []),
];
export const CENTRAL_AUTH_URL = resolveCentralAuthUrl();

export const DEFAULT_LANGUAGE_CODE = 'en';
export const DEFAULT_DEFINITION_LANGUAGE_CODE = 'ko';

export const PN_EXTENSION_ID = process.env.EXPO_PUBLIC_PN_EXTENSION_ID ?? '';

export interface LanguageOption {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
];

import type { LanguageOptionsResponse, MeResponse, SessionResponse } from '@project-pn/api';
import {
  getLanguageOptions as getLanguageOptionsApi,
  logout as logoutApi,
  me as meApi,
} from './client';
import { sessionStorage } from './storage';

let languageOptionsCache: Promise<LanguageOptionsResponse> | null = null;
let languageOptionsCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearLanguageOptionsCache(): void {
  languageOptionsCache = null;
  languageOptionsCacheTime = 0;
}

export async function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  const now = Date.now();
  if (languageOptionsCache && now - languageOptionsCacheTime < CACHE_TTL_MS) {
    return languageOptionsCache;
  }
  languageOptionsCache = getLanguageOptionsApi().catch((err) => {
    clearLanguageOptionsCache();
    throw err;
  });
  languageOptionsCacheTime = now;
  return languageOptionsCache;
}

export async function me(): Promise<MeResponse> {
  return meApi();
}

export async function logout(): Promise<void> {
  try {
    await logoutApi();
  } finally {
    clearLanguageOptionsCache();
    await sessionStorage.removeToken();
  }
}

export type { SessionResponse };

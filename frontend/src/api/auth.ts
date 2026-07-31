import { CENTRAL_AUTH_URL } from '../config';
import type { LanguageOptionsResponse, LoginRequest, MeResponse, SessionResponse } from '@project-pn/api';
import {
  createSession as createSessionApi,
  getLanguageOptions as getLanguageOptionsApi,
  logout as logoutApi,
  me as meApi,
} from './client';
import { sessionStorage } from './sessionStorage';
import { isBrowserWeb } from '../utils/platform';

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

export async function login(email: string, password: string): Promise<SessionResponse> {
  if (isBrowserWeb()) {
    throw new Error('Web sign-in uses the central cookie session.');
  }
  if (!CENTRAL_AUTH_URL) {
    throw new Error('Central auth URL is not configured.');
  }
  const body: LoginRequest = { email, password };
  const session = await createSessionApi(CENTRAL_AUTH_URL, body);
  await sessionStorage.setToken(session.token);
  return session;
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

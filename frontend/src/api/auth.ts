import {
  confirmMergeRequest,
  createMergeRequest,
  getLinkedProviders,
} from '@project-pn/api';
import type { LinkedProvider, MeResponse } from '@project-pn/api';
import {
  getLanguageOptions as getLanguageOptionsApi,
  logout as logoutApi,
  me as meApi,
  refreshSession as refreshSessionApi,
} from './client';
import { sessionStorage } from './sessionStorage';

let languageOptionsCache: Promise<Awaited<ReturnType<typeof getLanguageOptionsApi>>> | null = null;
let languageOptionsCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearLanguageOptionsCache(): void {
  languageOptionsCache = null;
  languageOptionsCacheTime = 0;
}

export async function getLanguageOptions() {
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

export async function refreshSession(refreshToken: string) {
  const session = await refreshSessionApi(refreshToken);
  await sessionStorage.setSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await logoutApi();
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (status === 502 || status === 503) {
      throw err;
    }
    clearLanguageOptionsCache();
    await sessionStorage.clearSession();
    throw err;
  }
  clearLanguageOptionsCache();
  await sessionStorage.clearSession();
}

export {
  getLinkedProviders,
  createMergeRequest,
  confirmMergeRequest,
};
export type { LinkedProvider, MeResponse };

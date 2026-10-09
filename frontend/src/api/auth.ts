import {
  cancelLinkRequest,
  confirmLinkRequest,
  confirmMergeRequest,
  createLinkRequest,
  createMergeRequest,
  getCurrentLinkRequest,
  getLinkedProviders,
  resendLinkRequest,
} from '@project-pn/api';
import type { LinkRequest, LinkedProvider, MeResponse } from '@project-pn/api';
import { CENTRAL_AUTH_URL } from '../config';
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
    if (typeof window !== 'undefined') {
      try {
        await fetch(`${CENTRAL_AUTH_URL}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      } catch (err) {
        console.warn('Platform logout error:', err);
      }
    }
    await logoutApi().catch(() => {});
  } finally {
    clearLanguageOptionsCache();
    await sessionStorage.clearSession();
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = window.location.origin;
    }
  }
}

export {
  getLinkedProviders,
  createLinkRequest,
  getCurrentLinkRequest,
  resendLinkRequest,
  cancelLinkRequest,
  confirmLinkRequest,
  createMergeRequest,
  confirmMergeRequest,
};
export type { LinkRequest, LinkedProvider, MeResponse };

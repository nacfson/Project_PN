import { configureApi } from '@project-pn/api';
import { sessionStorage } from './sessionStorage';
import { API_BASE_URLS } from '../config';
import { isBrowserWeb } from '../utils/platform';
import { extractTokenFromUrl } from '../utils/authLaunch';
import { reportUnreachableBackend } from './devBackendHint';

let devUrlToken: string | null = null;

function readDevUrlToken(): string | null {
  if (!__DEV__ || !isBrowserWeb() || typeof window === 'undefined') {
    return null;
  }
  const urlToken = extractTokenFromUrl(window.location.href);
  if (urlToken) {
    devUrlToken = urlToken;
    return urlToken;
  }
  return devUrlToken;
}

/**
 * Clears the in-memory __DEV__ browser URL token cached on initial load.
 */
export function clearDevUrlToken(): void {
  devUrlToken = null;
}

function getCsrfToken(): string | null {
  if (!isBrowserWeb() || typeof document === 'undefined') {
    return null;
  }
  const prefix = 'project_pn_csrf=';
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function resolveAuthMode(): 'bearer' | 'cookie' {
  if (!isBrowserWeb()) {
    return 'bearer';
  }
  if (readDevUrlToken()) {
    return 'bearer';
  }
  return 'cookie';
}

configureApi({
  baseUrls: API_BASE_URLS,
  authMode: resolveAuthMode(),
  getToken: async () => {
    const devToken = readDevUrlToken();
    if (devToken) {
      return devToken;
    }
    return sessionStorage.getToken();
  },
  getRefreshToken: async () => {
    if (resolveAuthMode() === 'cookie') {
      return null;
    }
    return sessionStorage.getRefreshToken();
  },
  onSessionRefreshed: async (session) => {
    await sessionStorage.setSession(session);
  },
  getCsrfToken,
  onNetworkError: __DEV__ ? (info) => { reportUnreachableBackend(info); } : undefined,
  onUnauthorized: () => {
    clearDevUrlToken();
    if (!isBrowserWeb()) {
      sessionStorage.clearSession().catch((err) => {
        console.error('Failed to clear session on 401:', err);
      });
    }
  },
});

export * from '@project-pn/api';

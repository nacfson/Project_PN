import { configureApi } from '@project-pn/api';
import { sessionStorage } from './sessionStorage';
import { API_BASE_URLS } from '../config';
import { isBrowserWeb } from '../utils/platform';
import { extractTokenFromUrl } from '../utils/authLaunch';

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
  if (__DEV__ && typeof window !== 'undefined' && extractTokenFromUrl(window.location.href)) {
    return 'bearer';
  }
  return 'cookie';
}

configureApi({
  baseUrls: API_BASE_URLS,
  authMode: resolveAuthMode(),
  getToken: async () => {
    if (__DEV__ && isBrowserWeb() && typeof window !== 'undefined') {
      const urlToken = extractTokenFromUrl(window.location.href);
      if (urlToken) {
        return urlToken;
      }
    }
    return sessionStorage.getToken();
  },
  getCsrfToken,
  onUnauthorized: () => {
    if (!isBrowserWeb()) {
      sessionStorage.removeToken().catch((err) => {
        console.error('Failed to clear token on 401:', err);
      });
    }
  },
});

export * from '@project-pn/api';

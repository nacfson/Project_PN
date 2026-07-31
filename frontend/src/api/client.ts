import { configureApi } from '@project-pn/api';
import { sessionStorage } from './sessionStorage';
import { API_BASE_URLS } from '../config';
import { isBrowserWeb } from '../utils/platform';

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

configureApi({
  baseUrls: API_BASE_URLS,
  authMode: isBrowserWeb() ? 'cookie' : 'bearer',
  getToken: () => sessionStorage.getToken(),
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

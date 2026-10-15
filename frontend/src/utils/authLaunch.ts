import { Linking } from 'react-native';
import type { SessionResponse } from '@project-pn/api';
import { API_BASE_URL } from '../config';
import { isBrowserWeb } from './platform';

function extractParamFromUrl(urlStr: string, param: string): string | null {
  try {
    const hashIndex = urlStr.indexOf('#');
    const beforeHash = hashIndex === -1 ? urlStr : urlStr.substring(0, hashIndex);
    const hashPart = hashIndex === -1 ? '' : urlStr.substring(hashIndex + 1);
    const pattern = new RegExp(`[?&]${param}=([^&#]+)`);

    const searchMatch = beforeHash.match(pattern);
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1]);
    }

    const hashMatch = hashPart.match(new RegExp(`(?:^|[?&])${param}=([^&#]+)`));
    if (hashMatch) {
      return decodeURIComponent(hashMatch[1]);
    }

    return null;
  } catch {
    return null;
  }
}

export function extractTokenFromUrl(urlStr: string): string | null {
  return extractParamFromUrl(urlStr, 'token');
}

export function extractSessionFromUrl(urlStr: string): SessionResponse | null {
  const token = extractParamFromUrl(urlStr, 'token');
  if (!token) {
    return null;
  }

  return {
    token,
    refresh_token: extractParamFromUrl(urlStr, 'refresh_token') ?? token,
    expires_at: extractParamFromUrl(urlStr, 'expires_at') ?? new Date(Date.now() + 3600_000).toISOString(),
  };
}

export async function parseSessionFromLaunchUrl(): Promise<SessionResponse | null> {
  try {
    if (isBrowserWeb()) {
      if (typeof window === 'undefined' || !window.location) {
        return null;
      }

      let searchStr = window.location.search ?? '';
      let pathname = window.location.pathname ?? '/';
      let hash = window.location.hash ?? '';

      if (!searchStr && window.location.href) {
        try {
          const parsed = new URL(window.location.href);
          searchStr = parsed.search;
          pathname = parsed.pathname;
          hash = parsed.hash;
        } catch {
          // ignore invalid href
        }
      }

      const params = new URLSearchParams(searchStr);
      const code = params.get('code');
      if (!code) {
        return null;
      }

      params.delete('code');
      const remainingQuery = params.toString();
      const cleanUrl = `${pathname}${remainingQuery ? `?${remainingQuery}` : ''}${hash}`;
      if (window.history && typeof window.history.replaceState === 'function') {
        const title = typeof document !== 'undefined' ? document.title : '';
        window.history.replaceState({}, title, cleanUrl);
      }

      const resp = await fetch(`${API_BASE_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!resp.ok) {
        return null;
      }

      const session = (await resp.json()) as SessionResponse;
      if (!session || !session.token) {
        return null;
      }
      return session;
    }

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      return extractSessionFromUrl(initialUrl);
    }
    return null;
  } catch {
    return null;
  }
}

export async function parseTokenFromLaunchUrl(): Promise<string | null> {
  const session = await parseSessionFromLaunchUrl();
  return session?.token ?? null;
}

export async function parseVerifiedEmailFromLaunchUrl(): Promise<string | null> {
  return null;
}

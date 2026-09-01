import { Linking } from 'react-native';
import type { SessionResponse } from '@project-pn/api';
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
      return null;
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

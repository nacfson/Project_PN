import { Linking, Platform } from 'react-native';

export function extractTokenFromUrl(urlStr: string): string | null {
  try {
    // 1. Look for '?token=...' or '&token=...'
    const searchMatch = urlStr.match(/[?&]token=([^&#]+)/);
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1]);
    }
    // 2. Look for '#...token=...' inside the hash segment (e.g. #/dashboard?token=...)
    const hashIndex = urlStr.indexOf('#');
    if (hashIndex !== -1) {
      const hashPart = urlStr.substring(hashIndex);
      const hashMatch = hashPart.match(/[?&]token=([^&#]+)/);
      if (hashMatch) {
        return decodeURIComponent(hashMatch[1]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function parseTokenFromLaunchUrl(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const token = extractTokenFromUrl(window.location.href);
      if (token) {
        if (url.searchParams.has('token')) {
          url.searchParams.delete('token');
        }
        if (url.hash.includes('token=')) {
          const [hashPath, hashQuery] = url.hash.split('?');
          if (hashQuery) {
            const hashParams = new URLSearchParams(hashQuery);
            hashParams.delete('token');
            const cleanHashQuery = hashParams.toString();
            url.hash = cleanHashQuery ? `${hashPath}?${cleanHashQuery}` : hashPath;
          }
        }
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        return token;
      }
    }
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      return extractTokenFromUrl(initialUrl);
    }
    return null;
  } catch {
    return null;
  }
}

export async function parseVerifiedEmailFromLaunchUrl(): Promise<string | null> {
  return null;
}

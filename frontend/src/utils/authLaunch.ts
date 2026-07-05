import { Linking, Platform } from 'react-native';

export function extractTokenFromUrl(urlStr: string): string | null {
  try {
    // Split into the part before # and the hash fragment.
    const hashIndex = urlStr.indexOf('#');
    const beforeHash = hashIndex === -1 ? urlStr : urlStr.substring(0, hashIndex);
    const hashPart = hashIndex === -1 ? '' : urlStr.substring(hashIndex + 1);

    // 1. Look for '?token=...' or '&token=...' in the query string (before #).
    const searchMatch = beforeHash.match(/[?&]token=([^&#]+)/);
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1]);
    }

    // 2. Look for 'token=...' inside the hash fragment.
    //    Supports '#/dashboard?token=...' and the raw '#token=...' style used by the central auth server.
    const hashMatch = hashPart.match(/(?:^|[?&])token=([^&#]+)/);
    if (hashMatch) {
      return decodeURIComponent(hashMatch[1]);
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

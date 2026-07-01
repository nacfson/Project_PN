import { Linking, Platform } from 'react-native';

export function extractTokenFromUrl(urlStr: string): string | null {
  try {
    let absoluteUrl = urlStr;
    if (!urlStr.includes(':/')) {
      absoluteUrl = `http://localhost/${urlStr.replace(/^[?#]/, '')}`;
    }
    const url = new URL(absoluteUrl);
    
    let token = url.searchParams.get('token');
    if (token) {
      return token;
    }
    
    if (url.hash.includes('token=')) {
      const hashQuery = url.hash.split('?')[1];
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        token = hashParams.get('token');
        if (token) {
          return token;
        }
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

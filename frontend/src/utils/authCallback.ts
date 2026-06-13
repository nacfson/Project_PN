export const AUTH_CALLBACK_SCHEME = 'projectpn';
export const AUTH_CALLBACK_PATH = 'auth/callback';

/** Whether the URL is a magic-link or OAuth return to our callback route. */
export function isAuthCallbackUrl(url: string): boolean {
  if (url.startsWith(`${AUTH_CALLBACK_SCHEME}://`)) {
    return url.includes(AUTH_CALLBACK_PATH);
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname === `/${AUTH_CALLBACK_PATH}` || parsed.pathname.endsWith(`/${AUTH_CALLBACK_PATH}`);
  } catch {
    return url.includes(AUTH_CALLBACK_PATH);
  }
}

/** Read exchange `code` from fragment (#code=) or query (?code=). */
export function parseMagicCodeFromCallbackUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const fromHash = new URLSearchParams(url.slice(hashIndex + 1)).get('code');
    if (fromHash) {
      return fromHash;
    }
  }

  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get('code');
    if (fromQuery) {
      return fromQuery;
    }
  } catch {
    const queryMatch = url.match(/[?&]code=([^&#]+)/);
    if (queryMatch?.[1]) {
      return decodeURIComponent(queryMatch[1]);
    }
  }

  return null;
}

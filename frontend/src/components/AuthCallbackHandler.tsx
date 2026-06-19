import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { exchangeMagicCode } from '../api/auth';
import { useAppLanguage } from '../i18n';
import { isAuthCallbackUrl, parseMagicCodeFromCallbackUrl } from '../utils/authCallback';
import { isTauri } from '../utils/platform';

interface AuthCallbackHandlerProps {
  onAuthenticated: () => void;
  onError?: (message: string) => void;
}

function parseMagicCodeFromWebLocation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash;
  if (hash.startsWith('#')) {
    const fromHash = new URLSearchParams(hash.slice(1)).get('code');
    if (fromHash) {
      return fromHash;
    }
  }

  return new URLSearchParams(window.location.search).get('code');
}

function stripCallbackFromHistory(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.delete('code');
  if (url.pathname === '/auth/callback') {
    url.pathname = '/';
  }
  window.history.replaceState({}, '', url.pathname + url.search);
}

/**
 * Magic-link callback: web reads location hash/query; native and Tauri use deep links
 * (projectpn://auth/callback#code= or https APP_PUBLIC_URL/auth/callback#code=).
 */
export function AuthCallbackHandler({ onAuthenticated, onError }: AuthCallbackHandlerProps) {
  const handled = useRef(false);
  const { t } = useAppLanguage();

  useEffect(() => {
    const exchangeCode = async (code: string, stripWebHistory: boolean) => {
      if (handled.current) {
        return;
      }
      handled.current = true;

      try {
        await exchangeMagicCode(code);
        if (stripWebHistory) {
          stripCallbackFromHistory();
        }
        onAuthenticated();
      } catch (err) {
        if (stripWebHistory) {
          stripCallbackFromHistory();
        }
        const message = err instanceof Error ? err.message : t('auth.magicLinkSignInFailed');
        onError?.(message);
      }
    };

    const handleCallbackUrl = (url: string | null) => {
      if (!url || !isAuthCallbackUrl(url)) {
        return;
      }
      const code = parseMagicCodeFromCallbackUrl(url);
      if (!code) {
        return;
      }
      void exchangeCode(code, false);
    };

    if (Platform.OS === 'web') {
      const code = parseMagicCodeFromWebLocation();
      if (code) {
        void exchangeCode(code, true);
      }
    }

    let removeLinking: (() => void) | undefined;
    if (Platform.OS !== 'web') {
      void Linking.getInitialURL().then(handleCallbackUrl);
      const subscription = Linking.addEventListener('url', (event) => {
        handleCallbackUrl(event.url);
      });
      removeLinking = () => subscription.remove();
    }

    let cancelled = false;
    if (Platform.OS === 'web' && isTauri()) {
      void (async () => {
        try {
          const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
          if (cancelled) {
            return;
          }
          const startUrls = await getCurrent();
          if (startUrls?.[0]) {
            handleCallbackUrl(startUrls[0]);
          }
          await onOpenUrl((urls) => {
            handleCallbackUrl(urls[0] ?? null);
          });
        } catch {
          // Deep-link plugin unavailable outside Tauri builds.
        }
      })();
    }

    return () => {
      cancelled = true;
      removeLinking?.();
    };
  }, [onAuthenticated, onError, t]);

  return null;
}

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { refreshSession as refreshSessionApi } from '../api/client';
import { me } from '../api/auth';
import { sessionStorage } from '../api/sessionStorage';
import { isBrowserWeb } from '../utils/platform';
import { msUntilRefresh, shouldRefreshProactively } from '../utils/sessionRenewal';

async function renewBearerSession(): Promise<boolean> {
  const refreshToken = await sessionStorage.getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  try {
    const session = await refreshSessionApi(refreshToken);
    await sessionStorage.setSession(session);
    return true;
  } catch {
    return false;
  }
}

export function useSessionRenewal(enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRenewal = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled || isBrowserWeb()) {
      return;
    }

    const expiresAt = await sessionStorage.getExpiresAt();
    const delay = msUntilRefresh(expiresAt);
    if (delay == null) {
      return;
    }

    timerRef.current = setTimeout(() => {
      void renewBearerSession().then((ok) => {
        if (ok) {
          void scheduleRenewal();
        }
      });
    }, delay);
  }, [enabled]);

  const keepAlive = useCallback(async () => {
    if (!enabled) {
      return;
    }
    if (isBrowserWeb()) {
      try {
        await me();
      } catch {
        // App-level auth handling covers failures.
      }
      return;
    }

    const expiresAt = await sessionStorage.getExpiresAt();
    if (!shouldRefreshProactively(expiresAt)) {
      return;
    }
    const renewed = await renewBearerSession();
    if (renewed) {
      void scheduleRenewal();
    }
  }, [enabled, scheduleRenewal]);

  useEffect(() => {
    void scheduleRenewal();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [scheduleRenewal]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isBrowserWeb() && typeof document !== 'undefined') {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          void keepAlive();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void keepAlive();
      }
    };
    const subscription = AppState.addEventListener('change', onAppState);
    return () => subscription.remove();
  }, [enabled, keepAlive]);
}

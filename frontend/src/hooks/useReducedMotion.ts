import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Returns `true` when the user prefers reduced motion.
 *
 * On web this reads `prefers-reduced-motion: reduce` and listens for changes.
 * On iOS/Android this wraps `AccessibilityInfo.isReduceMotionEnabled()` and the
 * `reduceMotionChanged` event.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return;
      }

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);

      const handleChange = (event: MediaQueryListEvent) => {
        if (active) {
          setReducedMotion(event.matches);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => {
        active = false;
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    let subscription: { remove: () => void } | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReducedMotion(enabled);
      }
    });

    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      if (active) {
        setReducedMotion(enabled);
      }
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return reducedMotion;
}

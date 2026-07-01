import { Platform, AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

// Spring configurations matching the approved motion spec
export const spring = {
  bouncy: {
    tension: 180,
    friction: 12,
  },
  gentle: {
    tension: 120,
    friction: 14,
  },
  stiff: {
    tension: 250,
    friction: 20,
  },
} as const;

export const timing = {
  fade: 200,
  loading: 300,
} as const;

export const scale = {
  press: 0.96,
  pop: 1.05,
} as const;

// Hook to listen to reduced motion accessibility
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const listener = (event: MediaQueryListEvent) => {
        if (active) setReduced(event.matches);
      };
      mediaQuery.addEventListener('change', listener);
      return () => {
        active = false;
        mediaQuery.removeEventListener('change', listener);
      };
    } else {
      AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
        if (active) setReduced(enabled);
      });
      const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (active) setReduced(enabled);
      });
      return () => {
        active = false;
        sub.remove();
      };
    }
  }, []);

  return reduced;
}

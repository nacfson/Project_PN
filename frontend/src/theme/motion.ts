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
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
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
  }, []);
  return reduced;
}

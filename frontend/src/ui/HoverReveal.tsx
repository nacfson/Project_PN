import { ReactNode, useState } from 'react';
import { Animated, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { shellKind, shellLayout } from '../navigation/shellKind';

interface HoverRevealProps {
  children: ReactNode;
}

export function HoverReveal({ children }: HoverRevealProps) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isTouchDevice =
    Platform.OS !== 'web' ||
    shellLayout(shellKind(Platform.OS, ua), width) === 'bottom' ||
    width < 720;

  const [visible, setVisible] = useState(false);
  const opacity = useState(() => new Animated.Value(0))[0];

  const animateTo = (value: number) => {
    if (reduced || isTouchDevice) return;
    Animated.timing(opacity, {
      toValue: value,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  if (isTouchDevice) {
    return <Animated.View style={{ opacity: 1 }}>{children}</Animated.View>;
  }

  return (
    <Pressable
      onHoverIn={() => {
        setVisible(true);
        animateTo(1);
      }}
      onHoverOut={() => {
        setVisible(false);
        animateTo(0);
      }}
      onFocus={() => {
        setVisible(true);
        animateTo(1);
      }}
      onBlur={() => {
        setVisible(false);
        animateTo(0);
      }}
    >
      <Animated.View style={{ opacity: reduced || visible ? 1 : opacity }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

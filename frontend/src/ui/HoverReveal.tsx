import { ReactNode, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface HoverRevealProps {
  children: ReactNode;
}

export function HoverReveal({ children }: HoverRevealProps) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const opacity = useState(() => new Animated.Value(0))[0];

  const animateTo = (value: number) => {
    if (reduced) return;
    Animated.timing(opacity, {
      toValue: value,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

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

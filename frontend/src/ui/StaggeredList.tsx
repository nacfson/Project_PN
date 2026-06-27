import { Children, ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface StaggeredListProps {
  children: ReactNode;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}

export function StaggeredList({ children, delayMs = 40, style }: StaggeredListProps) {
  const reduced = useReducedMotion();
  const anims = useRef<Animated.Value[]>([]);
  const items = Children.toArray(children);

  if (anims.current.length !== items.length) {
    anims.current = items.map(() => new Animated.Value(reduced ? 1 : 0));
  }

  useEffect(() => {
    if (reduced) return;
    const animations = anims.current.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        delay: index * delayMs,
        useNativeDriver: true,
      })
    );
    Animated.stagger(delayMs, animations).start();
  }, [items.length, delayMs, reduced]);

  return (
    <Animated.View style={style}>
      {items.map((child, index) => {
        const anim = anims.current[index] ?? new Animated.Value(1);
        return (
          <Animated.View
            key={index}
            style={{
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            }}
          >
            {child}
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

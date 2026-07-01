import { Children, ReactNode, useEffect, useRef } from 'react';
import { Animated, Platform, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { spring } from '../theme/motion';

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
    if (reduced) {
      // Ensure every item stays fully visible when reduced motion is enabled.
      anims.current.forEach((anim) => anim.setValue(1));
      return;
    }

    const animations = anims.current.map((anim) =>
      Animated.spring(anim, {
        toValue: 1,
        ...spring.bouncy,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    const composite = Animated.stagger(delayMs, animations);
    composite.start();

    return () => {
      composite.stop();
    };
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
                    outputRange: [16, 0],
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

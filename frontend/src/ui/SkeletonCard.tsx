import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  const { colors, radii, spacing } = useTheme();
  const reduced = useReducedMotion();
  const shimmer = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [reduced, shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={{
        padding: spacing.lg,
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.xxl,
        gap: spacing.sm,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <View
          key={index}
          testID="skeleton-line"
          style={{
            height: 12,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceContainerHighest,
            width: index === lines - 1 ? '60%' : '100%',
            overflow: 'hidden',
          }}
        >
          {!reduced && (
            <Animated.View
              style={{
                width: '40%',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.35)',
                transform: [{ translateX }],
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}

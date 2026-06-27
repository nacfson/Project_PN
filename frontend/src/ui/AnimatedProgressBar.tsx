import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface AnimatedProgressBarProps {
  percent: number;
  height?: number;
}

export function AnimatedProgressBar({ percent, height = 12 }: AnimatedProgressBarProps) {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: reduced ? 0 : 350,
      useNativeDriver: false,
    }).start();
  }, [percent, reduced, widthAnim]);

  return (
    <View
      style={{
        height,
        borderRadius: radii.full,
        backgroundColor: colors.surfaceContainerHighest,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        testID="progress-fill"
        style={{
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: radii.full,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}

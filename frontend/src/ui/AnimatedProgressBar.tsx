import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface AnimatedProgressBarProps {
  percent: number;
  height?: number;
}

export function AnimatedProgressBar({ percent, height = 4 }: AnimatedProgressBarProps) {
  const { colors, motion, reduced } = useTheme();
  const { tension, friction } = motion.spring.bouncy;
  const clamped = Math.max(0, Math.min(100, percent));
  const widthAnim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (reduced) {
      widthAnim.setValue(clamped);
      return;
    }
    const anim = Animated.spring(widthAnim, {
      toValue: clamped,
      tension,
      friction,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [clamped, reduced, widthAnim, tension, friction]);

  return (
    <View
      style={{
        height,
        borderRadius: 2,
        backgroundColor: colors.hairline,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        testID="progress-fill"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
        style={{
          height: '100%',
          borderRadius: 2,
          backgroundColor: colors.accent,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}

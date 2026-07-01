import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface AnimatedProgressBarProps {
  percent: number;
  height?: number;
}

export function AnimatedProgressBar({ percent, height = 12 }: AnimatedProgressBarProps) {
  const { colors, radii, motion, reduced } = useTheme();
  const { tension, friction } = motion.spring.bouncy;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, percent));
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
  }, [percent, reduced, widthAnim, tension, friction]);

  useEffect(() => {
    if (reduced) {
      shimmerAnim.setValue(0.75);
      return;
    }
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.85,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.75,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [reduced, shimmerAnim]);

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
        accessibilityRole="progressbar"
        accessibilityValue={{ now: percent }}
        style={{
          height: '100%',
          borderRadius: radii.full,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
          overflow: 'hidden',
        }}
      >
        <AnimatedLinearGradient
          colors={[colors.primary, colors.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
        {!reduced && (
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              opacity: shimmerAnim,
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

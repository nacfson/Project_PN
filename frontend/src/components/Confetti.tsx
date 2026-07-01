import React, { useEffect, useRef } from 'react';
import { Animated, useWindowDimensions, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface ConfettiProps {
  active: boolean;
}

interface ParticleConfig {
  id: number;
  startX: number;
  driftX: number;
  duration: number;
  rotationDirection: number;
  scale: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  progress: Animated.Value;
  rotations: number;
}

export function Confetti({ active }: ConfettiProps) {
  const { colors, reduced } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const particlesRef = useRef<ParticleConfig[]>([]);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  if (particlesRef.current.length === 0) {
    const particleColors = [
      colors.primary,
      colors.accent,
      colors.accent2,
      '#FBBF24', // yellow
      '#22C55E', // green
      '#F97316', // orange
    ];

    const count = 45;
    const temp: ParticleConfig[] = [];
    for (let i = 0; i < count; i++) {
      const isCircle = Math.random() > 0.6;
      const w = 6 + Math.random() * 8;
      const h = 8 + Math.random() * 8;
      temp.push({
        id: i,
        startX: Math.random() * screenWidth,
        driftX: (Math.random() * 2 - 1) * 120, // drift up to 120px left or right
        duration: 2500 + Math.random() * 1000, // 2.5s - 3.5s
        rotationDirection: Math.random() > 0.5 ? 1 : -1,
        scale: 0.5 + Math.random() * 0.7,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        width: w,
        height: h,
        borderRadius: isCircle ? w / 2 : 2,
        progress: new Animated.Value(0),
        rotations: 1.5 + Math.random() * 2,
      });
    }
    particlesRef.current = temp;
  }

  useEffect(() => {
    if (reduced) return;

    if (active) {
      // Reset values to 0
      particlesRef.current.forEach((p) => p.progress.setValue(0));

      // Start all animations in parallel
      const animations = particlesRef.current.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: p.duration,
          useNativeDriver: true,
        }),
      );
      animationRef.current = Animated.parallel(animations);
      animationRef.current.start();
    } else {
      // Reset to 0 when not active
      particlesRef.current.forEach((p) => p.progress.setValue(0));
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [active, reduced]);

  if (!active || reduced) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none" testID="confetti-container">
      {particlesRef.current.map((p) => {
        // Interpolate transformations
        const translateY = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, screenHeight + 50],
        });

        const translateX = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [p.startX, p.startX + p.driftX],
        });

        const rotate = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotationDirection * 360 * p.rotations}deg`],
        });

        return (
          <Animated.View
            key={p.id}
            testID={`confetti-particle-${p.id}`}
            style={[
              styles.particle,
              {
                backgroundColor: p.color,
                width: p.width,
                height: p.height,
                borderRadius: p.borderRadius,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                  { scale: p.scale },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

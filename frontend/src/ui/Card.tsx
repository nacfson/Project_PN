import { useRef, useState, useEffect } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: 'filled' | 'outlined';
  glass?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  hoverElevation?: boolean;
  hoverScale?: boolean;
}

export function Card({
  elevated,
  variant = 'filled',
  glass,
  onPress,
  onLongPress,
  hoverElevation,
  hoverScale,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, spacing, radii, shadows, mode } = useTheme();
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleHoverIn = () => setHovered(true);
  const handleHoverOut = () => setHovered(false);

  const targetShadow = elevated || (hoverElevation && hovered) ? shadows.md : shadows.none;
  const targetScale = hoverScale && hovered && !reduced ? 1.01 : 1;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: targetScale,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [targetScale, scaleAnim]);

  const backgroundColor = glass
    ? colors.surfaceGlass
    : variant === 'filled'
      ? colors.surfaceContainerLow
      : colors.surface;

  const borderColor = glass
    ? colors.borderGlass
    : variant === 'outlined'
      ? colors.outlineVariant
      : 'transparent';

  const glassWebStyle = glass && Platform.OS === 'web'
    ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as Record<string, string>
    : undefined;

  const cardContent = (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          borderRadius: radii.xl,
          padding: spacing.lg,
          borderColor,
        },
        glassWebStyle,
        targetShadow,
        style,
      ]}
      {...rest}
    >
      {glass && Platform.OS === 'ios' ? (
        <BlurView
          intensity={20}
          tint={mode === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );

  if (!onPress && !hoverElevation && !hoverScale) {
    return cardContent;
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        {cardContent}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});

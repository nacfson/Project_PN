import { useRef, useState, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: 'filled' | 'outlined';
  onPress?: () => void;
  hoverElevation?: boolean;
  hoverScale?: boolean;
}

export function Card({
  elevated,
  variant = 'filled',
  onPress,
  hoverElevation,
  hoverScale,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();
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

  const cardBody = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variant === 'filled' ? colors.surfaceContainerLow : colors.surface,
          borderRadius: radii.xxl,
          padding: spacing.lg,
          borderColor: variant === 'outlined' ? colors.outlineVariant : 'transparent',
        },
        targetShadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  if (!onPress && !hoverElevation && !hoverScale) {
    return cardBody;
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        {cardBody}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});

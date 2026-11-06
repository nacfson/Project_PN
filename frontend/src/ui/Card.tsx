import { Platform, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
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
  glass,
  onPress,
  onLongPress,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  const cardContent = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.card,
          padding: spacing.lg,
          borderColor: colors.hairline,
        },
        shadows.playful,
        style,
      ]}
      {...rest}
    >
      {glass && Platform.OS === 'ios' ? (
        <BlurView
          intensity={20}
          tint="light"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );

  if (!onPress && !onLongPress) {
    return cardContent;
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {cardContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    overflow: 'hidden',
  },
});

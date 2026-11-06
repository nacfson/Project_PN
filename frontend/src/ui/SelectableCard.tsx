import React from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface SelectableCardProps extends Omit<PressableProps, 'children'> {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

export function SelectableCard({
  selected,
  onSelect,
  children,
  style,
  ...rest
}: SelectableCardProps) {
  const { colors, radii, spacing, shadows } = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      style={(state) => {
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        return [
          styles.card,
          {
            backgroundColor: selected ? colors.surfaceHighlight : colors.surface,
            borderRadius: radii.card,
            padding: spacing.lg,
            borderColor: selected
              ? colors.brandPrimary
              : hovered
                ? colors.controlBorderHover
                : colors.hairline,
          },
          shadows.playful,
          typeof style === 'function' ? style(state) : style,
        ];
      }}
      {...rest}
    >
      <View
        style={[
          styles.radio,
          {
            backgroundColor: colors.surfaceBase,
            borderColor: selected ? colors.brandPrimary : colors.controlBorder,
          },
        ]}
      >
        {selected ? (
          <View
            style={[
              styles.radioDot,
              {
                backgroundColor: colors.brandPrimary,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    position: 'relative',
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
});

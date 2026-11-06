import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ChipProps extends Omit<PressableProps, 'children'> {
  label: string;
  selected?: boolean;
  count?: number;
  icon?: React.ComponentProps<typeof Icon>['name'];
}

export function Chip({ label, selected = false, count, icon, ...rest }: ChipProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={(state) => {
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        return [
          styles.base,
          {
            height: 36,
            backgroundColor: selected
              ? colors.brandSecondary
              : hovered || state.pressed
                ? colors.fillAlt
                : colors.fill,
            borderColor: selected
              ? colors.brandSecondary
              : hovered || state.pressed
                ? colors.controlBorder
                : colors.hairline,
            borderWidth: 1,
            borderRadius: radii.full,
            paddingHorizontal: spacing.md,
          },
        ];
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...rest}
    >
      {icon && (
        <Icon
          name={icon}
          size="sm"
          color={selected ? colors.onPrimary : colors.text}
        />
      )}
      <Text
        variant="caption"
        style={{
          color: selected ? colors.onPrimary : colors.text,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
      {typeof count === 'number' ? (
        <View style={styles.countWrap}>
          <Text
            variant="caption"
            tabular
            style={{
              color: selected ? colors.onPrimary : colors.textSecondary,
              opacity: 0.85,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  countWrap: {
    marginLeft: 2,
  },
});

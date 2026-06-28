import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from './';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
}

interface ContextualCommandBarProps {
  selectedCount: number;
  actions: CommandAction[];
  onClear: () => void;
}

export function ContextualCommandBar({ selectedCount, actions, onClear }: ContextualCommandBarProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  if (selectedCount === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inverseSurface,
        borderRadius: radii.full,
        padding: spacing.sm,
        paddingHorizontal: spacing.lg,
        ...shadows.lg,
        zIndex: 50,
      }}
    >
      <Text variant="label" color="inverse" style={{ marginRight: spacing.md }}>
        {selectedCount} selected
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            disabled={action.disabled}
            onPress={action.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.sm,
              borderRadius: radii.full,
              opacity: pressed || action.disabled ? 0.6 : 1,
            })}
            accessibilityRole="button"
          >
            <Icon name={action.icon as never} size="sm" color={colors.inverseOnSurface} />
            <Text variant="caption" color="inverse">
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          testID="command-bar-clear"
          onPress={onClear}
          style={{ padding: spacing.sm }}
          accessibilityRole="button"
        >
          <Icon name="close" size="sm" color={colors.inverseOnSurface} />
        </Pressable>
      </View>
    </View>
  );
}

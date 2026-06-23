import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

type IconName = React.ComponentProps<typeof Icon>['name'];

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, { gap: spacing.md }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
        <Icon name={icon} size="xl" color={colors.primary} />
      </View>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

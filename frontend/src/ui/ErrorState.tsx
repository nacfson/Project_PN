import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAppLanguage } from '../i18n';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const resolvedTitle = title ?? t('common.somethingWrong');

  return (
    <View style={[styles.container, { gap: spacing.md }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSurface }]}>
        <Icon name="alert-circle" size="xl" color={colors.danger} />
      </View>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {resolvedTitle}
      </Text>
      {message ? (
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button label={t('common.retry')} onPress={onRetry} style={{ marginTop: spacing.sm }} />
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

import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from '../ui';
import { useAddQueue } from '../hooks/useAddQueue';

export function QueueBanner() {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const { jobs, pendingCount, dismissedIds, dismiss } = useAddQueue();

  const toasts = jobs.filter(
    (job) =>
      (job.status === 'done' || job.status === 'error') && !dismissedIds.has(job.id),
  );

  if (pendingCount === 0 && toasts.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.sm }]}>
      {pendingCount > 0 && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.warningSurface,
              borderColor: colors.warningBorder,
              borderRadius: radii.md,
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.warning} />
          <Text variant="body" style={{ color: colors.warning }}>
            {t('queue.adding', { count: pendingCount, plural: pendingCount === 1 ? '' : 's' })}
          </Text>
        </View>
      )}

      {toasts.map((job) => (
        <View
          key={job.id}
          style={[
            styles.banner,
            {
              borderRadius: radii.md,
              backgroundColor: job.status === 'done' ? colors.successSurface : colors.dangerSurface,
              borderColor: job.status === 'done' ? colors.successBorder : colors.dangerBorder,
            },
          ]}
        >
          <Icon
            name={job.status === 'done' ? 'checkmark-circle' : 'alert-circle'}
            size="md"
            color={job.status === 'done' ? colors.success : colors.danger}
          />
          <Text variant="body" style={{ flex: 1, color: job.status === 'done' ? colors.success : colors.danger }} numberOfLines={2}>
            {job.status === 'done'
              ? t('queue.added', { text: job.text })
              : t('queue.failed', { text: job.text, error: job.error ?? t('queue.unknownError') })}
          </Text>
          <Pressable
            onPress={() => dismiss(job.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('queue.dismiss')}
          >
            <Icon name="close" size="md" color={job.status === 'done' ? colors.success : colors.danger} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    gap: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

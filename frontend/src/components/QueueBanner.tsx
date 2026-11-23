import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAddQueue, type AddJob } from '../hooks/useAddQueue';
import { useAppLanguage } from '../i18n';
import { radii, spacing, useTheme } from '../theme';
import { Button, Icon, Text } from '../ui';

interface DoneToastItemProps {
  job: AddJob;
  dismiss: (id: string) => void;
}

function DoneToastItem({ job, dismiss }: DoneToastItemProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss(job.id);
    }, 2500);
    return () => clearTimeout(timer);
  }, [job.id, dismiss]);

  return (
    <View
      style={[
        styles.banner,
        {
          borderRadius: radii.md,
          backgroundColor: colors.successSurface,
          borderColor: colors.success,
        },
      ]}
    >
      <Icon name="checkmark-circle" size="md" color={colors.success} />
      <Text variant="body" style={{ flex: 1, color: colors.success }}>
        {t('queue.added', { text: job.text })}
      </Text>
      <Pressable
        onPress={() => dismiss(job.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('queue.dismiss')}
      >
        <Icon name="close" size="md" color={colors.success} />
      </Pressable>
    </View>
  );
}

interface ErrorToastItemProps {
  job: AddJob;
  dismiss: (id: string) => void;
  retry: (id: string) => void;
}

function SingleErrorToastItem({ job, dismiss, retry }: ErrorToastItemProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const info = job.errorInfo;

  return (
    <View
      style={[
        styles.banner,
        {
          borderRadius: radii.md,
          backgroundColor: colors.dangerSurface,
          borderColor: colors.danger,
        },
      ]}
    >
      <Icon name="alert-circle" size="md" color={colors.danger} />
      <View style={styles.errorTextCol}>
        <Text variant="bodySmall" color="danger" bold>
          {job.text}
          {info ? ` — ${t(info.titleKey)}` : ''}
        </Text>
        <Text variant="caption" color="danger">
          {job.error ?? t('queue.unknownError')}
        </Text>
        {info ? (
          <Text variant="caption" color="muted">
            {t('add.error.codeCaption', { code: info.code })}
          </Text>
        ) : null}
      </View>
      {info?.retryable ? (
        <Button
          label={t('common.retry')}
          variant="secondary"
          size="sm"
          onPress={() => retry(job.id)}
          testID={`queue-retry-${job.id}`}
        />
      ) : null}
      <Pressable
        onPress={() => dismiss(job.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('queue.dismiss')}
      >
        <Icon name="close" size="md" color={colors.danger} />
      </Pressable>
    </View>
  );
}

export function QueueBanner() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const {
    jobs,
    pendingCount,
    dismissedIds,
    dismiss,
    dismissAllErrors,
    retryJob,
    retryAllFailed,
  } = useAddQueue();
  const [expanded, setExpanded] = useState(false);

  const doneToasts = jobs.filter(
    (job) => job.status === 'done' && !dismissedIds.has(job.id),
  );
  const errorToasts = jobs.filter(
    (job) => job.status === 'error' && !dismissedIds.has(job.id),
  );
  const anyRetryable = errorToasts.some((job) => job.errorInfo?.retryable);

  if (pendingCount === 0 && doneToasts.length === 0 && errorToasts.length === 0) {
    return null;
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.container,
        {
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
          backgroundColor: colors.canvas,
        },
      ]}
    >
      {pendingCount > 0 && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.warningSurface,
              borderColor: colors.warning,
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

      {doneToasts.map((job) => (
        <DoneToastItem key={job.id} job={job} dismiss={dismiss} />
      ))}

      {errorToasts.length === 1 && (
        <SingleErrorToastItem
          key={errorToasts[0].id}
          job={errorToasts[0]}
          dismiss={dismiss}
          retry={retryJob}
        />
      )}

      {errorToasts.length >= 2 && (
        <View
          testID="queue-grouped-error"
          style={[
            styles.groupedBanner,
            {
              borderRadius: radii.md,
              backgroundColor: colors.dangerSurface,
              borderColor: colors.danger,
            },
          ]}
        >
          <View style={styles.groupedHeader}>
            <Icon name="alert-circle" size="md" color={colors.danger} />
            <Text variant="bodySmall" color="danger" bold style={{ flex: 1 }}>
              {t('queue.failedSummary', { count: errorToasts.length })}
            </Text>
            <Pressable
              onPress={() => setExpanded((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              testID="queue-toggle-details"
            >
              <Text variant="caption" color="accent" bold>
                {t(expanded ? 'queue.hideDetails' : 'queue.showDetails')}
              </Text>
            </Pressable>
            {anyRetryable ? (
              <Button
                label={t('queue.retryFailed')}
                variant="secondary"
                size="sm"
                onPress={retryAllFailed}
                testID="queue-retry-failed"
              />
            ) : null}
            <Pressable
              onPress={dismissAllErrors}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('queue.dismissAll')}
              testID="queue-dismiss-all"
            >
              <Icon name="close" size="md" color={colors.danger} />
            </Pressable>
          </View>

          {expanded && (
            <View style={[styles.groupedList, { borderTopColor: colors.hairline }]}>
              {errorToasts.map((job) => (
                <View key={job.id} style={styles.groupedRow}>
                  <View style={styles.errorTextCol}>
                    <Text variant="caption" color="danger" bold>
                      {job.text}
                      {job.errorInfo ? ` · ${t(job.errorInfo.titleKey)} (${job.errorInfo.code})` : ''}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {job.error ?? t('queue.unknownError')}
                    </Text>
                  </View>
                  {job.errorInfo?.retryable ? (
                    <Pressable onPress={() => retryJob(job.id)} hitSlop={8}>
                      <Text variant="caption" color="accent" bold>
                        {t('common.retry')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
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
  groupedBanner: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  groupedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  groupedList: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTextCol: {
    flex: 1,
    gap: 2,
  },
});

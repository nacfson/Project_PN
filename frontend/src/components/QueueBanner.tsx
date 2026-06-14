import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAddQueue } from '../hooks/useAddQueue';

export function QueueBanner() {
  const { jobs, pendingCount, dismissedIds, dismiss } = useAddQueue();

  const toasts = jobs.filter(
    (job) =>
      (job.status === 'done' || job.status === 'error') && !dismissedIds.has(job.id),
  );

  if (pendingCount === 0 && toasts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {pendingCount > 0 && (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color="#854d0e" />
          <Text style={styles.progressText}>
            Adding {pendingCount} word{pendingCount === 1 ? '' : 's'}...
          </Text>
        </View>
      )}

      {toasts.map((job) => (
        <View
          key={job.id}
          style={[styles.toast, job.status === 'done' ? styles.toastDone : styles.toastError]}
        >
          <Text style={styles.toastText} numberOfLines={2}>
            {job.status === 'done'
              ? `"${job.text}" added`
              : `"${job.text}" failed: ${job.error ?? 'Unknown error'}`}
          </Text>
          <Pressable
            onPress={() => dismiss(job.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
          >
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef9c3',
    borderColor: '#fde047',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#854d0e',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastDone: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  toastError: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  dismiss: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});

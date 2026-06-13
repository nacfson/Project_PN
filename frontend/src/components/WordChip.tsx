import { Pressable, StyleSheet, Text, View } from 'react-native';

export type WordStatus = 'idle' | 'pending' | 'added' | 'error';

interface WordChipProps {
  word: string;
  status: WordStatus;
  onPress?: () => void;
  onRemove?: () => void;
}

const STATUS_LABEL: Record<WordStatus, string> = {
  idle: '',
  pending: '...',
  added: 'added',
  error: 'error',
};

export function WordChip({ word, status, onPress, onRemove }: WordChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, styles[`chip_${status}`]]}
      accessibilityRole="button"
    >
      <Text style={styles.word}>{word}</Text>
      {STATUS_LABEL[status].length > 0 && <Text style={styles.status}>{STATUS_LABEL[status]}</Text>}
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${word}`}>
          <Text style={styles.remove}>x</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chip_idle: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  chip_pending: {
    backgroundColor: '#fef9c3',
    borderColor: '#fde047',
  },
  chip_added: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  chip_error: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  word: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  status: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  remove: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
});

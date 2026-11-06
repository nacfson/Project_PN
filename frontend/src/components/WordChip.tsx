import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from '../ui';

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
  const { colors, radii, spacing } = useTheme();

  const palette = {
    idle: { bg: colors.surface, border: colors.hairline, text: colors.text },
    pending: { bg: colors.warningSurface, border: colors.warning, text: colors.warning },
    added: { bg: colors.successSurface, border: colors.success, text: colors.success },
    error: { bg: colors.dangerSurface, border: colors.danger, text: colors.danger },
  };

  const { bg, border, text } = palette[status];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radii.full,
          borderColor: border,
          backgroundColor: bg,
        },
      ]}
      accessibilityRole="button"
    >
      <Text variant="label" style={{ color: text }}>
        {word}
      </Text>
      {STATUS_LABEL[status].length > 0 && (
        <Text variant="caption" style={{ color: text, textTransform: 'uppercase' }}>
          {STATUS_LABEL[status]}
        </Text>
      )}
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${word}`}>
          <Icon name="close-circle" size="sm" color={text} />
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
});

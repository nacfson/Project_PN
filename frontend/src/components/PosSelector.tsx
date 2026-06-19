import { Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';
import type { PosFilter } from '../types';

const OPTIONS: PosFilter[] = [
  'Any',
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'determiner',
];

interface PosSelectorProps {
  value: PosFilter;
  onChange: (value: PosFilter) => void;
}

export function PosSelector({ value, onChange }: PosSelectorProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.chip,
              {
                borderRadius: radii.full,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surface,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text variant="label" color={active ? 'inverse' : 'muted'}>
              {t(`pos.${option}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});

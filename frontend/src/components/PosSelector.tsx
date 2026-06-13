import { Pressable, StyleSheet, Text, View } from 'react-native';
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

// Optional part-of-speech filter. "Any" is the default and is a lookup filter
// only; it is never persisted or sent when adding a learning item.
export function PosSelector({ value, onChange }: PosSelectorProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option}</Text>
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
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  label: {
    fontSize: 13,
    color: '#475569',
  },
  labelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

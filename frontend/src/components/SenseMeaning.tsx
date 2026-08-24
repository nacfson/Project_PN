import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import type { MeaningFields } from '../utils/meanings';
import { splitMeanings } from '../utils/meanings';

interface SenseMeaningProps {
  option: MeaningFields;
  posColor?: string;
}

export function SenseMeaning({ option, posColor }: SenseMeaningProps) {
  const { simple, full } = splitMeanings(option);

  return (
    <View style={styles.block}>
      {simple ? (
        <Text variant="title" bold style={posColor ? { color: posColor } : undefined}>
          {simple}
        </Text>
      ) : null}
      {full ? (
        <Text variant="caption" color="muted">
          {full}
        </Text>
      ) : null}
      <Text variant="body">{option.definition}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 4,
    marginTop: 8,
  },
});

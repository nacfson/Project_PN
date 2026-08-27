import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import type { MeaningFields } from '../utils/meanings';
import { displayGloss } from '../utils/meanings';

interface SenseMeaningProps {
  option: MeaningFields;
  posColor?: string;
}

/** Select Words / sense options: one simple gloss only (e.g. 가지다). */
export function SenseMeaning({ option, posColor }: SenseMeaningProps) {
  const gloss = displayGloss(option);

  if (!gloss) {
    return null;
  }

  return (
    <View style={styles.block}>
      <Text variant="title" bold style={posColor ? { color: posColor } : undefined}>
        {gloss}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 4,
    marginTop: 8,
  },
});

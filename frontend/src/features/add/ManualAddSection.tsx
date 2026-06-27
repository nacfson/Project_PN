import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PosSelector } from '../../components/PosSelector';
import { WordChip } from '../../components/WordChip';
import { useAddQueue } from '../../hooks/useAddQueue';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Input, Text } from '../../ui';
import type { PosFilter } from '../../types';

interface ManualAddSectionProps {
  selectedDeckId: string;
}

export function ManualAddSection({ selectedDeckId }: ManualAddSectionProps) {
  const { spacing } = useTheme();
  const { t } = useAppLanguage();
  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const { enqueue, statusOf } = useAddQueue();

  const submit = () => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      return;
    }
    enqueue(trimmed, pos, selectedDeckId);
    setWord('');
  };

  return (
    <View style={[styles.card, { backgroundColor: 'white', borderRadius: 16, padding: spacing.lg }]}>
      <Text variant="title" style={{ marginBottom: spacing.md }}>
        {t('add.addOneWord')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Input
          value={word}
          onChangeText={setWord}
          placeholder={t('add.wordPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={submit}
          returnKeyType="search"
          onClear={() => setWord('')}
          style={{ flex: 1 }}
        />
        <Button label={t('add.addWord')} onPress={submit} disabled={word.trim().length === 0} />
      </View>

      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Text variant="label" color="muted">{t('add.partOfSpeechOptional')}</Text>
        <PosSelector value={pos} onChange={setPos} />
      </View>

      <View style={styles.chipRow}>
        {[word].filter(Boolean).map((w) => (
          <WordChip key={w} word={w} status={statusOf(w)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

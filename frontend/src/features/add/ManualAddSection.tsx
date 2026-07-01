import { useMemo, useState } from 'react';
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
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const { enqueue, statusOf, jobs } = useAddQueue();

  const submit = () => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      return;
    }
    enqueue(trimmed, pos, selectedDeckId);
    setWord('');
  };

  const recentJobs = useMemo(() => {
    const seen = new Set<string>();
    return jobs
      .filter((job) => job.deckId === selectedDeckId)
      .slice()
      .reverse()
      .filter((job) => {
        if (seen.has(job.text)) return false;
        seen.add(job.text);
        return true;
      })
      .slice(0, 10);
  }, [jobs, selectedDeckId]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: spacing.lg }]}>
      <Text variant="title" style={{ marginBottom: spacing.md }}>
        {t('add.addOneWord')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0 }} testID="manual-add-input-wrapper">
          <Input
            value={word}
            onChangeText={setWord}
            placeholder={t('add.wordPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
            returnKeyType="search"
            onClear={() => setWord('')}
          />
        </View>
        <Button label={t('add.addWord')} onPress={submit} disabled={word.trim().length === 0} />
      </View>

      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Text variant="label" color="muted">{t('add.partOfSpeechOptional')}</Text>
        <PosSelector value={pos} onChange={setPos} />
      </View>

      {recentJobs.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="muted">{t('add.added')}</Text>
          <View style={styles.chipRow}>
            {recentJobs.map((job) => (
              <WordChip key={job.id} word={job.text} status={statusOf(job.text)} />
            ))}
          </View>
        </View>
      )}
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

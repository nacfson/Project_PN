import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { PosSelector } from '../components/PosSelector';
import { WordChip } from '../components/WordChip';
import { useAddQueue } from '../hooks/useAddQueue';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, EmptyState, Input, Text } from '../ui';
import type { PosFilter } from '../types';

import { useActiveTargetLanguage } from '../hooks/useActiveTargetLanguage';

function isMultiWord(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length > 1;
}

export function ManualAddScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [posTouched, setPosTouched] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const { enqueue, statusOf } = useAddQueue();
  const { targetLanguage } = useActiveTargetLanguage();

  useEffect(() => {
    if (posTouched) return;
    if (isMultiWord(word)) {
      setPos('phrase');
    } else if (pos === 'phrase') {
      setPos('Any');
    }
  }, [word, pos, posTouched]);

  const submit = () => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      return;
    }

    const lookupPos: PosFilter = !posTouched && isMultiWord(trimmed) ? 'phrase' : pos;
    enqueue(trimmed, lookupPos, undefined, targetLanguage ?? undefined);
    setAdded((prev) => [trimmed, ...prev.filter((entry) => entry !== trimmed)]);
    setWord('');
    setPosTouched(false);
    setPos('Any');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl * 2 }]}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="muted">
            {t('add.addWordOrPhrase')}
          </Text>
          <Input
            value={word}
            onChangeText={setWord}
            placeholder={t('add.phrasePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
            returnKeyType="search"
            onClear={() => {
              setWord('');
              setPosTouched(false);
              setPos('Any');
            }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="muted">
            {t('add.partOfSpeechOptional')}
          </Text>
          <PosSelector
            value={pos}
            onChange={(next) => {
              setPosTouched(true);
              setPos(next);
            }}
          />
        </View>

        <Button
          label={t('add.lookUp')}
          iconLeft="search"
          onPress={submit}
          disabled={word.trim().length === 0}
          style={{ marginTop: spacing.sm }}
        />

        {added.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Text variant="label" color="muted">
              {t('add.added')}
            </Text>
            <View style={styles.addedRow}>
              {added.map((w, index) => (
                <WordChip key={`${w}-${index}`} word={w} status={statusOf(w)} />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              icon="create-outline"
              title={t('add.emptyManualTitle')}
              message={t('add.emptyManualMessage')}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  addedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

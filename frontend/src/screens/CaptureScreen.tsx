import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { PosSelector } from '../components/PosSelector';
import { WordChip } from '../components/WordChip';
import { TappablePassage } from '../components/TappablePassage';
import { useAddQueue } from '../hooks/useAddQueue';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Text } from '../ui';
import type { PosFilter } from '../types';

const UNDO_DURATION_MS = 3000;

export function CaptureScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [passage, setPassage] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const previousPassageRef = useRef('');
  const { enqueueMany, statusOf } = useAddQueue();

  useEffect(() => {
    if (!clearedAt) return;
    const timeout = setTimeout(() => setClearedAt(null), UNDO_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [clearedAt]);

  const clearPassage = () => {
    previousPassageRef.current = passage;
    setPassage('');
    setClearedAt(Date.now());
  };

  const undoClear = () => {
    setPassage(previousPassageRef.current);
    setClearedAt(null);
  };

  const toggle = useCallback((word: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  }, []);

  const addSelected = () => {
    const words = Array.from(selected).filter((w) => {
      const status = statusOf(w);
      return status !== 'added' && status !== 'pending';
    });
    if (words.length === 0) {
      return;
    }
    enqueueMany(words, pos);
  };

  const selectedList = Array.from(selected);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl * 2 }]}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="muted">
            {t('add.passage')}
          </Text>
          <TextInput
            value={passage}
            onChangeText={(text) => {
              setPassage(text);
              setClearedAt(null);
            }}
            placeholder={t('add.passagePlaceholder')}
            multiline
            style={[
              styles.input,
              {
                borderColor: colors.border,
                borderRadius: 10,
                backgroundColor: colors.surface,
                color: colors.text,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
            textAlignVertical="top"
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={styles.labelRow}>
            <Text variant="label" color="muted">
              {t('add.tapWords')}
            </Text>
            {clearedAt ? (
              <TouchableOpacity onPress={undoClear} hitSlop={8}>
                <Text variant="caption" color="primary">
                  {t('add.undoClear')}
                </Text>
              </TouchableOpacity>
            ) : (
              passage.length > 0 && (
                <TouchableOpacity onPress={clearPassage} hitSlop={8}>
                  <Text variant="caption" color="primary">
                    {t('add.clearPassage')}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
          <Card>
            <TappablePassage text={passage} selected={selected} onToggle={toggle} />
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="muted">
            {t('add.partOfSpeechOptional')}
          </Text>
          <PosSelector value={pos} onChange={setPos} />
        </View>

        {selectedList.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('add.selected', { count: selectedList.length })}
            </Text>
            <View style={styles.chipRow}>
              {selectedList.map((w) => (
                <WordChip key={w} word={w} status={statusOf(w)} onRemove={() => toggle(w)} />
              ))}
            </View>
          </View>
        )}

        <Button
          label={t('add.addSelected', { count: selected.size })}
          iconLeft="add"
          onPress={addSelected}
          disabled={selected.size === 0}
          style={{ marginTop: spacing.sm }}
        />
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: 1,
    minHeight: 110,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

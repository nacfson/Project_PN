import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { PosSelector } from '../../components/PosSelector';
import { TappablePassage, type PassageSpan } from '../../components/TappablePassage';
import { WordChip } from '../../components/WordChip';
import { useAddQueue } from '../../hooks/useAddQueue';
import { recordCapturedWords } from '../../storage/captureHistory';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Input, Text } from '../../ui';
import type { PosFilter } from '../../types';

const UNDO_DURATION_MS = 3000;

function spanKey(span: PassageSpan): string {
  return `${span.start}:${span.end}:${span.text}`;
}

export function CaptureSection({ selectedDeckId, targetLanguage }: { selectedDeckId: string; targetLanguage: string }) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();
  const [passage, setPassage] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [selected, setSelected] = useState<PassageSpan[]>([]);
  const [phraseMode, setPhraseMode] = useState(false);
  const [phraseAnchor, setPhraseAnchor] = useState<number | null>(null);
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
    setSelected([]);
    setPhraseAnchor(null);
    setClearedAt(Date.now());
  };

  const undoClear = () => {
    setPassage(previousPassageRef.current);
    setClearedAt(null);
  };

  const toggleSpan = useCallback((span: PassageSpan) => {
    setSelected((prev) => {
      const exists = prev.find(
        (s) => s.start === span.start && s.end === span.end && s.text === span.text,
      );
      if (exists) {
        return prev.filter((s) => s !== exists);
      }
      // Drop overlapping single-token picks covered by a new multi-word span.
      const withoutOverlap = prev.filter(
        (s) => s.end < span.start || s.start > span.end,
      );
      return [...withoutOverlap, span];
    });
    if (span.text.trim()) {
      void recordCapturedWords([span.text]);
    }
  }, []);

  const addSelected = () => {
    const spans = selected.filter((span) => {
      const status = statusOf(span.text);
      return status !== 'added' && status !== 'pending';
    });
    if (spans.length === 0) {
      return;
    }
    const texts = spans.map((s) => s.text);
    void recordCapturedWords(texts);
    enqueueMany(texts, pos, selectedDeckId, targetLanguage);
  };

  const selectedList = selected;
  const hasPendingSelected = selectedList.some((s) => statusOf(s.text) === 'pending');
  const addableCount = selectedList.filter((s) => {
    const status = statusOf(s.text);
    return status !== 'added' && status !== 'pending';
  }).length;

  return (
    <View style={styles.container}>
      <View style={[styles.content, { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl * 2 }]}>
        <Text variant="title">{t('add.fromPassage')}</Text>

        <View style={{ gap: spacing.sm }}>
          <View style={styles.labelRow}>
            <Text variant="label" color="muted">
              {t('add.passage')}
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
          <Input
            value={passage}
            onChangeText={(text) => {
              setPassage(text);
              setSelected([]);
              setPhraseAnchor(null);
              setClearedAt(null);
            }}
            placeholder={t('add.passagePlaceholder')}
            multiline
            style={styles.passageInput}
            textAlignVertical="top"
          />
        </View>

        {passage.trim() !== '' && (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.labelRow}>
              <Text variant="label" color="muted">
                {phraseMode ? t('add.tapPhrase') : t('add.tapWords')}
              </Text>
              <Pressable
                onPress={() => {
                  setPhraseMode((prev) => !prev);
                  setPhraseAnchor(null);
                }}
                style={[
                  styles.phraseToggle,
                  {
                    borderRadius: radii.full,
                    borderColor: phraseMode ? 'transparent' : colors.outline,
                    backgroundColor: phraseMode ? colors.secondaryContainer : 'transparent',
                  },
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: phraseMode }}
                testID="phrase-mode-toggle"
              >
                <Text variant="caption" color={phraseMode ? 'onSecondaryContainer' : 'muted'}>
                  {t('add.phraseMode')}
                </Text>
              </Pressable>
            </View>
            <Card>
              <TappablePassage
                text={passage}
                selected={selected}
                phraseMode={phraseMode}
                phraseAnchor={phraseAnchor}
                onToggleSpan={toggleSpan}
                onPhraseAnchor={setPhraseAnchor}
              />
            </Card>
          </View>
        )}

        {selected.length > 0 && (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="muted">
                {t('add.partOfSpeechOptional')}
              </Text>
              <PosSelector value={pos} onChange={setPos} />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="muted">
                {t('add.selected', { count: selectedList.length })}
              </Text>
              <View style={styles.chipRow}>
                {selectedList.map((span) => (
                  <WordChip
                    key={spanKey(span)}
                    word={span.text}
                    status={statusOf(span.text)}
                    onRemove={() => toggleSpan(span)}
                  />
                ))}
              </View>
            </View>

            <Button
              label={t('add.addSelected', { count: selected.length })}
              iconLeft="add"
              onPress={addSelected}
              disabled={selected.length === 0 || addableCount === 0 || hasPendingSelected}
              loading={hasPendingSelected}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </View>
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
  passageInput: {
    minHeight: 110,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phraseToggle: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});

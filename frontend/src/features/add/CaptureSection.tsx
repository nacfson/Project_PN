import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ApiError } from '../../api/client';
import { PosSelector } from '../../components/PosSelector';
import { SensePicker } from '../../components/SensePicker';
import { TappablePassage, type PassageSpan } from '../../components/TappablePassage';
import { WordChip } from '../../components/WordChip';
import { useAddQueue } from '../../hooks/useAddQueue';
import { useSenseFlow } from '../../hooks/useSenseFlow';
import { recordCapturedWords } from '../../storage/captureHistory';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Input, Text } from '../../ui';
import type { PosFilter } from '../../types';
import { classifyAddError } from '../../utils/addErrors';

const UNDO_DURATION_MS = 3000;

function spanKey(span: PassageSpan): string {
  return `${span.start}:${span.end}:${span.text}`;
}

export function extractSentenceContext(passage: string, term: string): string | undefined {
  const cleanPassage = passage.trim();
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanPassage || !cleanTerm) return undefined;
  const sentences = cleanPassage
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const found = sentences.find((sentence) => sentence.toLowerCase().includes(cleanTerm));
  if (found) return found;
  return cleanPassage.length <= 240 ? cleanPassage : cleanPassage.slice(0, 240);
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
  const { enqueueMany, statusOf, jobs = [], markManualAdded } = useAddQueue();

  const {
    pickerVisible,
    query,
    options,
    lookingUp,
    confirming,
    error,
    errorInfo,
    translationMissing,
    suggestPosPrompt,
    openFailedLookup,
    retry,
    forceExisting,
    forceWithPos,
    confirm,
    addManual,
    close,
  } = useSenseFlow({
    onAdded: (wordSenseId, text) => {
      if (text) {
        markManualAdded?.(text, wordSenseId);
      }
    },
  });

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
    const sourceContexts: Record<string, string> = {};
    for (const span of spans) {
      const ctx = extractSentenceContext(passage, span.text);
      if (ctx) {
        sourceContexts[span.text.trim()] = ctx;
      }
    }
    void recordCapturedWords(texts);
    const lookupPos: PosFilter =
      pos === 'Any' && texts.every((text) => text.trim().split(/\s+/).filter(Boolean).length > 1)
        ? 'phrase'
        : pos;
    enqueueMany(texts, lookupPos, selectedDeckId, targetLanguage, sourceContexts);
  };

  const handleOpenFailedChip = (span: PassageSpan) => {
    const trimmed = span.text.trim();
    const matching = jobs.filter((job) => job.text === trimmed);
    const latest = matching[matching.length - 1];
    const lookupPos: PosFilter =
      pos === 'Any' && trimmed.split(/\s+/).filter(Boolean).length > 1 ? 'phrase' : pos;
    const context = latest?.sourceContext ?? extractSentenceContext(passage, trimmed);
    const info =
      latest?.errorInfo ??
      classifyAddError(new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'));
    openFailedLookup(trimmed, lookupPos, context, targetLanguage, selectedDeckId, info);
  };

  const selectedList = selected;
  const hasPendingSelected = selectedList.some((s) => statusOf(s.text) === 'pending');
  const hasErrorSelected = selectedList.some((s) => statusOf(s.text) === 'error');
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
                    borderColor: phraseMode ? colors.primary : colors.controlBorder,
                    backgroundColor: phraseMode ? colors.primary : colors.surface,
                  },
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: phraseMode }}
                testID="phrase-mode-toggle"
              >
                <Text variant="caption" color={phraseMode ? 'inverse' : 'muted'}>
                  {t('add.phraseMode')}
                </Text>
              </Pressable>
            </View>
            <Text variant="caption" color="muted">
              {t('add.phraseSelectHint')}
            </Text>
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
                {selectedList.map((span) => {
                  const status = statusOf(span.text);
                  return (
                    <WordChip
                      key={spanKey(span)}
                      testID={`word-chip-${span.text}`}
                      word={span.text}
                      status={status}
                      onPress={status === 'error' ? () => handleOpenFailedChip(span) : undefined}
                      onRemove={() => toggleSpan(span)}
                    />
                  );
                })}
              </View>
              {hasErrorSelected ? (
                <Text variant="caption" color="muted">
                  {t('queue.tapToResolve')}
                </Text>
              ) : null}
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

      <SensePicker
        visible={pickerVisible}
        query={query}
        options={options}
        lookingUp={lookingUp}
        confirming={confirming}
        errorMessage={error}
        errorInfo={errorInfo}
        translationMissing={translationMissing}
        suggestPosPrompt={suggestPosPrompt}
        onConfirm={(wordSenseId, inlineNote) => {
          void confirm(wordSenseId, selectedDeckId, undefined, inlineNote);
        }}
        onAddManual={(note, manualPos) => {
          void addManual(note, manualPos, selectedDeckId);
        }}
        onRetry={() => {
          void retry();
        }}
        onForceExisting={forceExisting}
        onForceWithPos={forceWithPos}
        onClose={close}
      />
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

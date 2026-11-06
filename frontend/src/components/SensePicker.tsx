import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../i18n';
import type { TranslationKey } from '../i18n';
import { PAGE_WIDTH_FRAME } from '../navigation/shellKind';
import { useTheme } from '../theme/ThemeProvider';
import { Badge, Button, Icon, Input, SelectableCard, Text } from '../ui';
import type { PartOfSpeech, SenseOption } from '../types';
import { bestMatch, isClosestToContext } from '../utils/senses';
import { displayGloss } from '../utils/meanings';

const CONCRETE_POS: PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'determiner',
  'phrase',
];

interface SensePickerProps {
  visible: boolean;
  query: string;
  options: SenseOption[];
  /** Lookup / force-generate in flight (list “Generating…” spinner). */
  lookingUp?: boolean;
  /** Confirm/add in flight (Add button spinner). */
  confirming?: boolean;
  /** @deprecated Prefer lookingUp || confirming. Kept for older call sites. */
  generating?: boolean;
  errorMessage?: string | null;
  suggestPosPrompt?: boolean;
  sourceContext?: string;
  onSourceContextChange?: (context: string) => void;
  onConfirm: (wordSenseId: string) => void;
  onForceExisting: (wordId: string, sourceContext?: string) => void;
  onForceWithPos: (pos: PartOfSpeech, sourceContext?: string) => void;
  onClose: () => void;
}

export function SensePicker({
  visible,
  query,
  options,
  lookingUp,
  confirming,
  generating,
  errorMessage,
  suggestPosPrompt = false,
  sourceContext = '',
  onSourceContextChange,
  onConfirm,
  onForceExisting,
  onForceWithPos,
  onClose,
}: SensePickerProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posPrompt, setPosPrompt] = useState(false);
  const [needContext, setNeedContext] = useState(false);
  const [draftContext, setDraftContext] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<'best' | 'selected' | null>(null);

  const isLookingUp = lookingUp ?? generating ?? false;
  const isConfirming = confirming ?? false;
  const busy = isLookingUp || isConfirming;

  const top = useMemo(() => bestMatch(options), [options]);

  useEffect(() => {
    if (suggestPosPrompt) {
      setPosPrompt(true);
    }
  }, [suggestPosPrompt]);

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setPosPrompt(false);
      setNeedContext(false);
      setDraftContext('');
      setConfirmTarget(null);
      return;
    }
    if (options.length > 0 && (!selectedId || !options.some((o) => o.word_sense_id === selectedId))) {
      setSelectedId((top ?? options[0])?.word_sense_id ?? null);
    }
  }, [visible, options, top, selectedId]);

  useEffect(() => {
    if (!isConfirming) {
      setConfirmTarget(null);
    }
  }, [isConfirming]);

  const selected = options.find((o) => o.word_sense_id === selectedId) ?? null;
  const resolvedContext = (draftContext || sourceContext).trim();
  const showPosPrompt = posPrompt || suggestPosPrompt;

  const handleClose = () => {
    if (isConfirming) {
      return;
    }
    onClose();
  };

  const handleAddSelected = () => {
    const targetId = selectedId ?? top?.word_sense_id ?? options[0]?.word_sense_id;
    if (targetId && !busy) {
      setConfirmTarget('selected');
      onConfirm(targetId);
    }
  };

  const handleAddBestMatch = () => {
    if (top && !busy) {
      setConfirmTarget('best');
      onConfirm(top.word_sense_id);
    }
  };

  const proceedForce = (context: string) => {
    onSourceContextChange?.(context);
    const targetOption = selected ?? options[0] ?? null;
    if (targetOption) {
      onForceExisting(targetOption.word_id, context);
      setNeedContext(false);
      return;
    }
    setNeedContext(false);
    setPosPrompt(true);
  };

  const handleNoneMatch = () => {
    if (!resolvedContext) {
      setNeedContext(true);
      return;
    }
    proceedForce(resolvedContext);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View
          testID="bottom-sheet"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              borderColor: colors.hairline,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.controlBorder }]} />
          </View>

          <View style={[styles.header, { marginBottom: spacing.sm }]}>
            <View style={styles.headerTitleRow}>
              <Text variant="sectionTitle">{t('add.whichMeaning')}</Text>
              <Text variant="caption" color="muted">
                {t('add.foundCount', { count: options.length })}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              disabled={isConfirming}
              style={{ opacity: isConfirming ? 0.4 : 1 }}
            >
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          {errorMessage && (
            <View
              style={[
                styles.errorRow,
                { backgroundColor: colors.dangerSurface, marginBottom: spacing.sm },
              ]}
            >
              <Icon name="alert-circle" size="sm" color={colors.danger} />
              <Text variant="body" color="danger">
                {errorMessage}
              </Text>
            </View>
          )}

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: 10, paddingVertical: spacing.sm }}
          >
            {options.length === 0 && !isLookingUp && (
              <Text color="muted">{t('sense.noneFound')}</Text>
            )}

            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={`Meanings of ${query}`}
              style={{ gap: 10 }}
            >
              {options.map((option) => {
                const active = option.word_sense_id === selectedId;
                const closest = isClosestToContext(option, options);
                const gloss = displayGloss(option) || option.localized_definition || option.definition;
                const posLabel = t(`pos.${option.part_of_speech}` as TranslationKey);
                const metaLabel = option.cefr_level
                  ? `${posLabel} · ${option.cefr_level}`
                  : posLabel;

                return (
                  <SelectableCard
                    key={option.word_sense_id}
                    selected={active}
                    onSelect={() => {
                      if (!busy) {
                        setSelectedId(option.word_sense_id);
                      }
                    }}
                  >
                    <View style={styles.optionBody}>
                      <View style={styles.optionTopRow}>
                        <Text style={styles.glossText}>{gloss}</Text>
                        <Text variant="caption" color="muted">
                          {metaLabel}
                        </Text>
                        {closest ? (
                          <Badge label={t('sense.closestToContext')} variant="accent" />
                        ) : null}
                      </View>
                    </View>
                  </SelectableCard>
                );
              })}
            </View>

            {isLookingUp && (
              <View style={[styles.generating, { gap: spacing.sm }]}>
                <ActivityIndicator color={colors.accent} />
                <Text color="muted">{t('sense.generating')}</Text>
              </View>
            )}

            {needContext && (
              <View
                style={[
                  styles.posPrompt,
                  { borderTopColor: colors.hairline, paddingTop: spacing.md, gap: spacing.sm },
                ]}
              >
                <Text variant="label" color="muted">
                  {t('sense.needContext')}
                </Text>
                <Input
                  value={draftContext}
                  onChangeText={setDraftContext}
                  placeholder={t('add.whereSawPlaceholder')}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72 }}
                  onClear={() => setDraftContext('')}
                />
                <Button
                  label={t('sense.findMore')}
                  onPress={() => {
                    if (draftContext.trim()) {
                      proceedForce(draftContext.trim());
                    }
                  }}
                  disabled={!draftContext.trim() || busy}
                />
              </View>
            )}

            {showPosPrompt && !selected && (
              <View
                style={[
                  styles.posPrompt,
                  { borderTopColor: colors.hairline, paddingTop: spacing.md, gap: spacing.md },
                ]}
              >
                <Text variant="label" color="muted">
                  {t('sense.pickPartOfSpeech')}
                </Text>
                <View style={styles.posRow}>
                  {CONCRETE_POS.map((pos) => (
                    <Button
                      key={pos}
                      label={t(`pos.${pos}`)}
                      variant="secondary"
                      onPress={() => {
                        onForceWithPos(pos, resolvedContext || undefined);
                        setPosPrompt(false);
                      }}
                      disabled={busy}
                      style={styles.posChip}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.actions, { marginTop: spacing.md, gap: spacing.md }]}>
            <Button
              label={t('add.noneSearchAgain')}
              variant="link"
              onPress={handleNoneMatch}
              disabled={busy}
            />
            <View style={styles.rightActions}>
              {top ? (
                <Button
                  label={t('sense.addBest')}
                  variant="secondary"
                  onPress={handleAddBestMatch}
                  disabled={!top || busy}
                  loading={isConfirming && confirmTarget === 'best'}
                  testID="sense-add-best"
                />
              ) : null}
              <Button
                label={t('add.addToDeck')}
                variant="primary"
                onPress={handleAddSelected}
                disabled={(!selectedId && options.length === 0) || busy}
                loading={isConfirming && confirmTarget === 'selected'}
                testID="sense-add"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    ...PAGE_WIDTH_FRAME,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    flex: 1,
    flexWrap: 'wrap',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  list: {
    flexGrow: 0,
  },
  optionBody: {
    gap: 6,
  },
  optionTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 10,
  },
  glossText: {
    fontSize: 17,
    fontWeight: '500',
  },
  generating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posPrompt: {
    borderTopWidth: 1,
  },
  posRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  posChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

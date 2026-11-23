import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../i18n';
import type { TranslationKey } from '../i18n';
import { PAGE_WIDTH_FRAME } from '../navigation/shellKind';
import { useTheme } from '../theme/ThemeProvider';
import { Badge, Button, Icon, Input, SelectableCard, Text } from '../ui';
import type { PartOfSpeech, SenseOption } from '../types';
import type { AddErrorInfo } from '../utils/addErrors';
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

const MANUAL_POS_CHIPS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase'];
const SLOW_LOOKUP_HINT_MS = 5000;

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
  errorInfo?: AddErrorInfo | null;
  translationMissing?: boolean;
  initialPersonalNote?: string;
  suggestPosPrompt?: boolean;
  sourceContext?: string;
  onSourceContextChange?: (context: string) => void;
  onConfirm: (wordSenseId: string, personalNote?: string) => void;
  onAddManual?: (personalNote: string, partOfSpeech?: PartOfSpeech | 'unknown') => void;
  onRetry?: () => void;
  onEditWord?: () => void;
  onForceExisting: (wordId: string, sourceContext?: string) => void;
  onForceWithPos: (pos: PartOfSpeech, sourceContext?: string) => void;
  onClose: () => void;
}

function isWarningCategory(category?: AddErrorInfo['category']): boolean {
  return category === 'not_found' || category === 'translation_missing' || category === 'no_more_senses';
}

export function SensePicker({
  visible,
  query,
  options,
  lookingUp,
  confirming,
  generating,
  errorMessage,
  errorInfo,
  translationMissing = false,
  initialPersonalNote = '',
  suggestPosPrompt = false,
  sourceContext = '',
  onSourceContextChange,
  onConfirm,
  onAddManual,
  onRetry,
  onEditWord,
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
  const [slowLookup, setSlowLookup] = useState(false);
  const [manualToggle, setManualToggle] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [manualNoteTouched, setManualNoteTouched] = useState(false);
  const [manualPos, setManualPos] = useState<PartOfSpeech | null>(null);

  const isLookingUp = lookingUp ?? generating ?? false;
  const isConfirming = confirming ?? false;
  const busy = isLookingUp || isConfirming;

  const top = useMemo(() => bestMatch(options), [options]);

  useEffect(() => {
    if (!isLookingUp) {
      setSlowLookup(false);
      return;
    }
    const timer = setTimeout(() => setSlowLookup(true), SLOW_LOOKUP_HINT_MS);
    return () => clearTimeout(timer);
  }, [isLookingUp]);

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
      setSlowLookup(false);
      setManualToggle(false);
      setManualNote('');
      setManualNoteTouched(false);
      setManualPos(null);
      return;
    }
    if (initialPersonalNote.trim() && !manualNoteTouched && !manualNote) {
      setManualNote(initialPersonalNote);
    }
    if (options.length > 0 && (!selectedId || !options.some((o) => o.word_sense_id === selectedId))) {
      setSelectedId((top ?? options[0])?.word_sense_id ?? null);
    }
  }, [visible, options, top, selectedId, initialPersonalNote, manualNoteTouched, manualNote]);

  useEffect(() => {
    if (!isConfirming) {
      setConfirmTarget(null);
    }
  }, [isConfirming]);

  const selected = options.find((o) => o.word_sense_id === selectedId) ?? null;
  const resolvedContext = (draftContext || sourceContext).trim();
  const showPosPrompt = posPrompt || suggestPosPrompt;
  const autoManualForm =
    options.length === 0 &&
    !isLookingUp &&
    Boolean(onAddManual) &&
    (errorInfo ? errorInfo.canManualAdd : Boolean(errorMessage));
  const showManualForm = Boolean(onAddManual) && (manualToggle || autoManualForm);
  const needsInlineNote = (translationMissing && options.length > 0) || showManualForm;

  const isMultiWordQuery = query.trim().split(/\s+/).filter(Boolean).length > 1;
  const resolvedManualPos: PartOfSpeech | 'unknown' =
    manualPos ?? (isMultiWordQuery ? 'phrase' : 'unknown');

  const handleClose = () => {
    if (isConfirming) {
      return;
    }
    onClose();
  };

  const confirmWithNoteCheck = (targetId: string, targetKind: 'best' | 'selected') => {
    if (translationMissing) {
      const trimmed = manualNote.trim();
      if (!trimmed) {
        setManualNoteTouched(true);
        return;
      }
      setConfirmTarget(targetKind);
      onConfirm(targetId, trimmed);
      return;
    }
    setConfirmTarget(targetKind);
    onConfirm(targetId);
  };

  const handleAddSelected = () => {
    const targetId = selectedId ?? top?.word_sense_id ?? options[0]?.word_sense_id;
    if (targetId && !busy) {
      confirmWithNoteCheck(targetId, 'selected');
    }
  };

  const handleAddBestMatch = () => {
    if (top && !busy) {
      confirmWithNoteCheck(top.word_sense_id, 'best');
    }
  };

  const handleSaveManual = () => {
    if (!onAddManual || busy) return;
    const trimmed = manualNote.trim();
    if (!trimmed) {
      setManualNoteTouched(true);
      return;
    }
    onAddManual(trimmed, resolvedManualPos);
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

  const hasErrorDisplay = Boolean(errorInfo || errorMessage);
  const errorAsWarning = isWarningCategory(errorInfo?.category);
  const errorBg = errorAsWarning ? colors.warningSurface : colors.dangerSurface;
  const errorBorder = errorAsWarning ? colors.warning : colors.danger;
  const errorColor: 'warning' | 'danger' = errorAsWarning ? 'warning' : 'danger';
  const errorIconColor = errorAsWarning ? colors.warning : colors.danger;

  const hideFooterNoneMatch = options.length === 0 && !isLookingUp && (hasErrorDisplay || showManualForm);

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

          {hasErrorDisplay && (
            <View
              testID="sense-error-card"
              style={[
                styles.errorCard,
                {
                  backgroundColor: errorBg,
                  borderColor: errorBorder,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <View style={styles.errorHeader}>
                <Icon
                  name={errorAsWarning ? 'help-circle' : 'alert-circle'}
                  size="sm"
                  color={errorIconColor}
                />
                <View style={styles.errorTextCol}>
                  {errorInfo ? (
                    <Text variant="bodySmall" color={errorColor} bold>
                      {t(errorInfo.titleKey)}
                    </Text>
                  ) : null}
                  <Text variant="bodySmall" color={errorColor}>
                    {errorInfo ? t(errorInfo.messageKey) : errorMessage}
                  </Text>
                  {errorInfo ? (
                    <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                      {t('add.error.codeCaption', { code: errorInfo.code })}
                    </Text>
                  ) : null}
                </View>
              </View>
              {(errorInfo?.retryable && onRetry) || (errorInfo?.category === 'not_found' && onEditWord) ? (
                <View style={styles.errorActions}>
                  {errorInfo?.retryable && onRetry ? (
                    <Button
                      label={t('common.retry')}
                      variant="secondary"
                      size="sm"
                      onPress={onRetry}
                      disabled={busy}
                      testID="sense-retry-button"
                    />
                  ) : null}
                  {errorInfo?.category === 'not_found' && onEditWord ? (
                    <Button
                      label={t('sense.editWord')}
                      variant="quiet"
                      size="sm"
                      onPress={onEditWord}
                      disabled={busy}
                      testID="sense-edit-word-button"
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          )}

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: 10, paddingVertical: spacing.sm }}
          >
            {translationMissing && options.length > 0 && (
              <View
                testID="sense-translation-missing-banner"
                style={[
                  styles.infoBanner,
                  { backgroundColor: colors.warningSurface, borderColor: colors.warning },
                ]}
              >
                <Text variant="bodySmall" color="warning" bold>
                  {t('sense.translationMissingTitle')}
                </Text>
                <Text variant="caption" color="secondary">
                  {t('sense.translationMissingBody')}
                </Text>
              </View>
            )}

            {options.length === 0 && !isLookingUp && !showManualForm && !hasErrorDisplay && (
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
                const gloss = translationMissing
                  ? option.definition || option.localized_definition
                  : displayGloss(option) || option.localized_definition || option.definition;
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
                <Text color="muted">
                  {slowLookup ? t('sense.checkingMoreSources') : t('sense.lookingUp')}
                </Text>
              </View>
            )}

            {needsInlineNote && (
              <View
                style={[
                  styles.posPrompt,
                  { borderTopColor: colors.hairline, paddingTop: spacing.md, gap: spacing.sm },
                ]}
              >
                <Text variant="label" color="default" bold>
                  {showManualForm
                    ? t('sense.manualFallbackTitle', { query })
                    : t('add.ownWording')}
                </Text>
                <Input
                  value={manualNote}
                  onChangeText={setManualNote}
                  onBlur={() => setManualNoteTouched(true)}
                  placeholder={t('sense.manualPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isConfirming}
                  error={manualNoteTouched && !manualNote.trim()}
                  helperText={
                    manualNoteTouched && !manualNote.trim()
                      ? t('sense.manualMeaningRequired')
                      : undefined
                  }
                  onClear={() => setManualNote('')}
                  testID={showManualForm ? 'sense-manual-input' : 'sense-translation-note-input'}
                />
                {showManualForm ? (
                  <>
                    <View style={styles.posRow}>
                      {MANUAL_POS_CHIPS.map((pos) => {
                        const active = manualPos === pos;
                        return (
                          <Pressable
                            key={pos}
                            onPress={() => setManualPos((prev) => (prev === pos ? null : pos))}
                            style={[
                              styles.manualPosChip,
                              {
                                borderRadius: radii.full,
                                borderColor: active ? colors.accent : colors.controlBorder,
                                backgroundColor: active ? colors.infoSurface : 'transparent',
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <Text variant="caption" color={active ? colors.accent : 'muted'}>
                              {t(`pos.${pos}`)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Button
                      label={t('sense.saveManual')}
                      variant="primary"
                      onPress={handleSaveManual}
                      disabled={busy}
                      loading={isConfirming}
                      testID="sense-save-manual"
                    />
                  </>
                ) : null}
              </View>
            )}

            {options.length > 0 && !isLookingUp && onAddManual && !showManualForm && (
              <Button
                label={t('sense.manualFallbackToggle')}
                variant="link"
                onPress={() => setManualToggle(true)}
                disabled={busy}
                testID="sense-manual-toggle"
              />
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

          {!hideFooterNoneMatch || options.length > 0 ? (
            <View style={[styles.actions, { marginTop: spacing.md, gap: spacing.md }]}>
              {!hideFooterNoneMatch ? (
                <Button
                  label={t('add.noneSearchAgain')}
                  variant="link"
                  onPress={handleNoneMatch}
                  disabled={busy}
                />
              ) : (
                <View />
              )}
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
                {options.length > 0 ? (
                  <Button
                    label={t('add.addToDeck')}
                    variant="primary"
                    onPress={handleAddSelected}
                    disabled={(!selectedId && options.length === 0) || busy}
                    loading={isConfirming && confirmTarget === 'selected'}
                    testID="sense-add"
                  />
                ) : null}
              </View>
            </View>
          ) : null}
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
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorTextCol: {
    flex: 1,
    gap: 2,
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
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
  manualPosChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
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

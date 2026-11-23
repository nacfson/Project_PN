import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import {
  changeLearningItemSense,
  lookupWord,
  setLearningItemPersonalNote,
} from '../../api/words';
import { SenseMeaning } from '../../components/SenseMeaning';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import { PAGE_WIDTH_FRAME } from '../../navigation/shellKind';
import { radii, spacing, useTheme } from '../../theme';
import type { LearningItemListItem, PartOfSpeech, SenseOption } from '../../types';
import { Badge, Button, Card, Icon, Input, Text } from '../../ui';
import { classifyAddError, type AddErrorInfo } from '../../utils/addErrors';
import { displayGloss } from '../../utils/meanings';
import { isClosestToContext } from '../../utils/senses';
import { renderFormattedSentence } from '../../utils/text';

const CONCRETE_POS: ReadonlySet<PartOfSpeech> = new Set<PartOfSpeech>([
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
]);

function toConcretePos(value?: string | null): PartOfSpeech | undefined {
  const normalized = value?.trim().toLowerCase() ?? '';
  return CONCRETE_POS.has(normalized as PartOfSpeech) ? (normalized as PartOfSpeech) : undefined;
}

interface ChangeMeaningSheetProps {
  visible: boolean;
  item: LearningItemListItem;
  onClose: () => void;
  onChanged: (next: LearningItemListItem) => void;
  onBusyChange?: (busy: boolean) => void;
  /** Open with the personal-note section expanded (session-end "Write my meaning"). */
  preferPersonalNote?: boolean;
}

export function ChangeMeaningSheet({
  visible,
  item,
  onClose,
  onChanged,
  onBusyChange,
  preferPersonalNote = false,
}: ChangeMeaningSheetProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState<SenseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AddErrorInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [personalDraft, setPersonalDraft] = useState('');
  const [personalTouched, setPersonalTouched] = useState(false);
  const [showPersonal, setShowPersonal] = useState(preferPersonalNote);
  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const isCustom = Boolean(item.is_custom || !item.word_sense_id);
  const concretePos = toConcretePos(item.part_of_speech);
  const canFindMore = Boolean(item.word_id || concretePos);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadSeqRef.current += 1;
    };
  }, []);

  const loadSenses = useCallback(() => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setFinding(false);
    setErrorInfo(null);
    setValidationError(null);
    lookupWord(item.lemma, { languageCode: item.language_code })
      .then((response) => {
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        setOptions(response.sense_options);
        if (response.sense_options.length === 0 || response.translation_missing) {
          setShowPersonal(true);
        }
      })
      .catch((err) => {
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        setErrorInfo(classifyAddError(err));
        setShowPersonal(true);
      })
      .finally(() => {
        if (mountedRef.current && seq === loadSeqRef.current) {
          setLoading(false);
        }
      });
  }, [item.lemma, item.language_code]);

  useEffect(() => {
    if (!visible) {
      loadSeqRef.current += 1;
      setLoading(false);
      setFinding(false);
      return;
    }
    setSelectedId(item.word_sense_id || null);
    setOptions([]);
    setContext('');
    setPersonalDraft(item.personal_note ?? '');
    setPersonalTouched(false);
    setShowPersonal(preferPersonalNote || isCustom || Boolean(item.personal_note?.trim()));
    loadSenses();
    return () => {
      loadSeqRef.current += 1;
    };
  }, [visible, item, isCustom, preferPersonalNote, loadSenses]);

  const handleFindMore = useCallback(async () => {
    if (!canFindMore) return;
    const trimmed = context.trim();
    if (!trimmed) {
      setErrorInfo(null);
      setValidationError(t('sense.needContext'));
      return;
    }
    const seq = ++loadSeqRef.current;
    setLoading(false);
    setFinding(true);
    setErrorInfo(null);
    setValidationError(null);
    try {
      const response = await lookupWord(item.lemma, {
        languageCode: item.language_code,
        ...(item.word_id ? { wordId: item.word_id } : {}),
        ...(concretePos ? { partOfSpeech: concretePos } : {}),
        force: true,
        sourceContext: trimmed,
      });
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setOptions(response.sense_options);
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return;
      setErrorInfo(classifyAddError(err));
    } finally {
      if (mountedRef.current && seq === loadSeqRef.current) {
        setFinding(false);
      }
    }
  }, [canFindMore, concretePos, context, item.lemma, item.language_code, item.word_id, t]);

  const handleSavePersonal = useCallback(async () => {
    const trimmed = personalDraft.trim();
    if (isCustom && !trimmed) {
      setPersonalTouched(true);
      return;
    }
    setSaving(true);
    onBusyChange?.(true);
    setErrorInfo(null);
    setValidationError(null);
    try {
      const updated = await setLearningItemPersonalNote(item.id, trimmed);
      const nextNote = updated.personal_note ?? (isCustom ? trimmed : null);
      onChanged({
        ...item,
        ...(isCustom
          ? {
              definition: nextNote ?? item.definition,
              localized_definition: nextNote ?? item.localized_definition,
            }
          : {}),
        personal_note: nextNote,
        word_sense_id: updated.word_sense_id || item.word_sense_id,
        due_at: updated.due_at || item.due_at,
        learning_stage: updated.learning_stage || item.learning_stage,
      });
      onClose();
    } catch (err) {
      setErrorInfo(classifyAddError(err));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }, [isCustom, item, personalDraft, onChanged, onClose, onBusyChange]);

  const handleConfirm = useCallback(async () => {
    const noteTrimmed = personalDraft.trim();
    const priorNote = item.personal_note?.trim() ?? '';
    const noteChanged = noteTrimmed !== priorNote;
    if (!selectedId) {
      if (isCustom && noteChanged && noteTrimmed.length > 0) {
        await handleSavePersonal();
        return;
      }
      onClose();
      return;
    }
    const senseUnchanged = selectedId === item.word_sense_id;
    if (senseUnchanged && !noteChanged) {
      onClose();
      return;
    }
    setSaving(true);
    onBusyChange?.(true);
    setErrorInfo(null);
    setValidationError(null);
    try {
      const notePayload = senseUnchanged ? noteTrimmed : noteChanged ? noteTrimmed : undefined;
      const updated = await changeLearningItemSense(item.id, selectedId, undefined, notePayload);
      const selected = options.find((o) => o.word_sense_id === selectedId);
      onChanged({
        ...item,
        word_sense_id: updated.word_sense_id,
        is_custom: Boolean(updated.is_custom),
        word_id: selected ? selected.word_id : item.word_id,
        part_of_speech: selected ? selected.part_of_speech : item.part_of_speech,
        pronunciation: selected ? selected.pronunciation : item.pronunciation,
        definition: selected ? selected.definition : item.definition,
        short_definition: selected ? selected.short_definition : item.short_definition,
        localized_definition: selected ? selected.localized_definition : item.localized_definition,
        localized_short_definition: selected
          ? selected.localized_short_definition
          : item.localized_short_definition,
        cefr_level: selected ? selected.cefr_level : item.cefr_level,
        examples: selected ? selected.examples : item.examples,
        meaning_order: selected ? selected.meaning_order : item.meaning_order,
        due_at: updated.due_at || item.due_at,
        learning_stage: updated.learning_stage || item.learning_stage,
        personal_note: updated.personal_note ?? null,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrorInfo(null);
        setValidationError(t('words.senseConflict'));
      } else {
        setErrorInfo(classifyAddError(err));
      }
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }, [handleSavePersonal, isCustom, item, onBusyChange, onChanged, onClose, options, personalDraft, selectedId, t]);

  const handleClearPersonal = useCallback(async () => {
    if (!item.personal_note?.trim()) return;
    setSaving(true);
    onBusyChange?.(true);
    setErrorInfo(null);
    setValidationError(null);
    try {
      const updated = await setLearningItemPersonalNote(item.id, '');
      onChanged({
        ...item,
        personal_note: updated.personal_note ?? null,
      });
      setPersonalDraft('');
      onClose();
    } catch (err) {
      setErrorInfo(classifyAddError(err));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }, [item, onChanged, onClose, onBusyChange]);

  const personalTrimmed = personalDraft.trim();
  const personalChanged = personalTrimmed !== (item.personal_note ?? '').trim();
  const currentGloss = displayGloss(item) ?? '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View
          testID="bottom-sheet"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.hairline,
              borderTopWidth: 1,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.controlBorder }]} />
          </View>
          <View style={[styles.header, { marginBottom: spacing.sm }]}>
            <Text variant="sectionTitle">{t('words.changeMeaningTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Icon name="close" size="lg" />
            </Pressable>
          </View>
          <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
            {item.lemma}
            {currentGloss ? ` · ${currentGloss}` : ''}
          </Text>

          {validationError && (
            <Text variant="body" color={colors.danger} style={{ marginBottom: spacing.sm }}>
              {validationError}
            </Text>
          )}

          {errorInfo && (
            <View
              testID="change-meaning-error-card"
              style={[
                styles.errorCard,
                {
                  backgroundColor: colors.dangerSurface,
                  borderColor: colors.danger,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <Text variant="bodySmall" color="danger" bold>
                {t(errorInfo.titleKey)}
              </Text>
              <Text variant="caption" color="danger">
                {t(errorInfo.messageKey)}
              </Text>
              <Text variant="caption" color="muted">
                {t('add.error.codeCaption', { code: errorInfo.code })}
              </Text>
              {errorInfo.retryable && (
                <Button
                  label={t('common.retry')}
                  variant="secondary"
                  size="sm"
                  onPress={loadSenses}
                  disabled={loading || saving}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                />
              )}
            </View>
          )}

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
          >
            {loading && (
              <View style={[styles.loading, { gap: spacing.sm }]}>
                <ActivityIndicator color={colors.accent} />
                <Text color={colors.textSecondary}>{t('sense.lookingUp')}</Text>
              </View>
            )}
            {!loading &&
              options.map((option) => {
                const active = option.word_sense_id === selectedId;
                const closest = isClosestToContext(option, options);
                return (
                  <Pressable
                    key={option.word_sense_id}
                    onPress={() => setSelectedId(option.word_sense_id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Card
                      variant="outlined"
                      style={{
                        borderColor: active ? colors.accent : colors.hairline,
                        backgroundColor: active ? colors.infoSurface : colors.surface,
                        marginBottom: 0,
                      }}
                    >
                      <View style={[styles.optionHead, { gap: spacing.sm }]}>
                        <Badge
                          label={t(`pos.${option.part_of_speech}` as TranslationKey)}
                          variant="accent"
                        />
                        {closest && <Badge label={t('sense.closestToContext')} variant="success" />}
                      </View>
                      <SenseMeaning option={option} />
                      {(option.examples ?? []).length > 0 && (
                        <Text
                          variant="caption"
                          color={colors.textSecondary}
                          style={{ marginTop: spacing.xs, fontStyle: 'italic' }}
                        >
                          &ldquo;
                          {renderFormattedSentence((option.examples ?? [])[0].sentence, item.lemma)}
                          &rdquo;
                        </Text>
                      )}
                    </Card>
                  </Pressable>
                );
              })}

            {canFindMore ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="groupLabel" color={colors.textSecondary}>
                  {t('add.contextLabel')}
                </Text>
                <Input
                  value={context}
                  onChangeText={setContext}
                  placeholder={t('add.contextPlaceholder')}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72 }}
                  onClear={() => setContext('')}
                />
                <Button
                  label={t('sense.findMore')}
                  variant="secondary"
                  onPress={() => {
                    void handleFindMore();
                  }}
                  disabled={finding || loading || saving}
                  loading={finding}
                />
              </View>
            ) : null}

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {!showPersonal ? (
                <Pressable
                  onPress={() => setShowPersonal(true)}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text variant="body" color={colors.accent} bold>
                    {t('words.personalMeaningTitle')}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Text variant="sectionTitle">{t('words.personalMeaningTitle')}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {t('words.personalMeaningHelp')}
                  </Text>
                  <Input
                    value={personalDraft}
                    onChangeText={setPersonalDraft}
                    onBlur={() => setPersonalTouched(true)}
                    placeholder={t('words.personalMeaningPlaceholder')}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 72 }}
                    editable={!saving}
                    error={personalTouched && personalChanged && !personalTrimmed}
                    helperText={
                      personalTouched && personalChanged && !personalTrimmed
                        ? t('words.personalMeaningRequired')
                        : undefined
                    }
                    onClear={() => setPersonalDraft('')}
                  />
                  <Button
                    label={t('words.personalMeaningSave')}
                    onPress={() => {
                      void handleSavePersonal();
                    }}
                    disabled={!personalChanged || saving || (isCustom && !personalTrimmed)}
                    loading={saving}
                  />
                  {!isCustom && item.personal_note?.trim() ? (
                    <Button
                      label={t('words.personalMeaningClear')}
                      variant="quiet"
                      onPress={() => {
                        void handleClearPersonal();
                      }}
                      disabled={saving}
                    />
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>

          <Button
            label={t('words.changeMeaningConfirm')}
            onPress={() => {
              void handleConfirm();
            }}
            disabled={
              saving ||
              loading ||
              (!selectedId && !(isCustom && personalChanged && Boolean(personalTrimmed)))
            }
            loading={saving && !showPersonal}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { ...PAGE_WIDTH_FRAME, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 8 },
  dragHandle: { alignItems: 'center', paddingVertical: 8 },
  dragIndicator: { width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  list: { flexGrow: 0 },
  loading: { alignItems: 'center', paddingVertical: 24 },
  optionHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});

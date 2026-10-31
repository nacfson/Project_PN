import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import {
  changeLearningItemSense,
  lookupWord,
  setLearningItemPersonalNote,
} from '../../api/words';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import { PAGE_WIDTH_FRAME } from '../../navigation/shellKind';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Input, Text } from '../../ui';
import type { LearningItemListItem, SenseOption } from '../../types';
import { renderFormattedSentence } from '../../utils/text';
import { isClosestToContext } from '../../utils/senses';
import { SenseMeaning } from '../../components/SenseMeaning';
import { displayGloss } from '../../utils/meanings';

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
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState<SenseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [personalDraft, setPersonalDraft] = useState('');
  const [personalTouched, setPersonalTouched] = useState(false);
  const [showPersonal, setShowPersonal] = useState(preferPersonalNote);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedId(item.word_sense_id);
    setOptions([]);
    setContext('');
    setPersonalDraft(item.personal_note ?? '');
    setPersonalTouched(false);
    setShowPersonal(preferPersonalNote || Boolean(item.personal_note?.trim()));
    lookupWord(item.lemma, { languageCode: item.language_code })
      .then((response) => {
        if (!active) return;
        setOptions(response.sense_options);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('common.somethingWrong'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, item, preferPersonalNote, t]);

  const handleFindMore = useCallback(async () => {
    const trimmed = context.trim();
    if (!trimmed) {
      setError(t('sense.needContext'));
      return;
    }
    setFinding(true);
    setError(null);
    try {
      const response = await lookupWord(item.lemma, {
        languageCode: item.language_code,
        wordId: item.word_id,
        force: true,
        sourceContext: trimmed,
      });
      setOptions(response.sense_options);
    } catch (err) {
      if (err instanceof ApiError && /no additional distinct sense/i.test(err.message)) {
        setError(t('sense.noAdditional'));
      } else {
        setError(err instanceof Error ? err.message : t('common.somethingWrong'));
      }
    } finally {
      setFinding(false);
    }
  }, [context, item.lemma, item.language_code, item.word_id, t]);

  const handleConfirm = useCallback(async () => {
    if (!selectedId) {
      onClose();
      return;
    }
    const noteTrimmed = personalDraft.trim();
    const priorNote = item.personal_note?.trim() ?? '';
    const senseUnchanged = selectedId === item.word_sense_id;
    const noteUnchanged = noteTrimmed === priorNote;
    if (senseUnchanged && noteUnchanged) {
      onClose();
      return;
    }
    setSaving(true);
    onBusyChange?.(true);
    setError(null);
    try {
      // Always send personal_note on change-meaning so sense swap clears when empty.
      const notePayload = noteTrimmed;
      const updated = await changeLearningItemSense(item.id, selectedId, undefined, notePayload);
      const selected = options.find((o) => o.word_sense_id === selectedId);
      onChanged({
        ...item,
        word_sense_id: updated.word_sense_id,
        definition: selected?.definition ?? item.definition,
        short_definition: selected?.short_definition ?? item.short_definition,
        localized_definition: selected?.localized_definition ?? item.localized_definition,
        localized_short_definition:
          selected?.localized_short_definition ?? item.localized_short_definition,
        examples: selected?.examples ?? item.examples,
        meaning_order: selected?.meaning_order ?? item.meaning_order,
        due_at: updated.due_at || item.due_at,
        learning_stage: updated.learning_stage || item.learning_stage,
        personal_note: updated.personal_note ?? (noteTrimmed || null),
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t('words.senseConflict'));
      } else {
        setError(err instanceof Error ? err.message : t('common.somethingWrong'));
      }
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }, [selectedId, personalDraft, item, options, onChanged, onClose, onBusyChange, t]);

  const handleSavePersonal = useCallback(async () => {
    setSaving(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const updated = await setLearningItemPersonalNote(item.id, personalDraft);
      onChanged({
        ...item,
        personal_note: updated.personal_note ?? null,
        word_sense_id: updated.word_sense_id || item.word_sense_id,
        due_at: updated.due_at || item.due_at,
        learning_stage: updated.learning_stage || item.learning_stage,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }, [item, personalDraft, onChanged, onClose, onBusyChange, t]);

  const handleClearPersonal = useCallback(async () => {
    if (!item.personal_note?.trim()) return;
    setSaving(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const updated = await setLearningItemPersonalNote(item.id, '');
      onChanged({
        ...item,
        personal_note: updated.personal_note ?? null,
      });
      setPersonalDraft('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }, [item, onChanged, onClose, onBusyChange, t]);

  const personalTrimmed = personalDraft.trim();
  const personalChanged = personalTrimmed !== (item.personal_note ?? '').trim();
  const currentGloss = displayGloss(item) ?? '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View
          testID="bottom-sheet"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.outlineVariant }]} />
          </View>
          <View style={[styles.header, { marginBottom: spacing.sm }]}>
            <Text variant="title">{t('words.changeMeaningTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Icon name="close" size="lg" />
            </Pressable>
          </View>
          <Text variant="caption" color="muted" style={{ marginBottom: spacing.sm }}>
            {item.lemma}
            {currentGloss ? ` · ${currentGloss}` : ''}
          </Text>

          {error && (
            <Text variant="body" color="danger" style={{ marginBottom: spacing.sm }}>
              {error}
            </Text>
          )}

          <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            {loading && (
              <View style={[styles.loading, { gap: spacing.sm }]}>
                <ActivityIndicator color={colors.primary} />
                <Text color="muted">{t('sense.generating')}</Text>
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
                        borderColor: active ? colors.primary : colors.outlineVariant,
                        backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow,
                        marginBottom: 0,
                      }}
                    >
                      <View style={[styles.optionHead, { gap: spacing.sm }]}>
                        <Badge label={t(`pos.${option.part_of_speech}` as TranslationKey)} variant="primary" />
                        {closest && <Badge label={t('sense.closestToContext')} variant="success" />}
                      </View>
                      <SenseMeaning option={option} />
                      {(option.examples ?? []).length > 0 && (
                        <Text variant="caption" color="muted" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
                          &ldquo;{renderFormattedSentence((option.examples ?? [])[0].sentence, item.lemma)}&rdquo;
                        </Text>
                      )}
                    </Card>
                  </Pressable>
                );
              })}

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="muted">
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
                variant="tonal"
                onPress={() => {
                  void handleFindMore();
                }}
                disabled={finding || loading || saving}
                loading={finding}
              />
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {!showPersonal ? (
                <Pressable
                  onPress={() => setShowPersonal(true)}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text variant="body" color="primary" bold>
                    {t('words.personalMeaningTitle')}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Text variant="title" bold>
                    {t('words.personalMeaningTitle')}
                  </Text>
                  <Text variant="caption" color="muted">
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
                    disabled={!personalChanged || saving}
                    loading={saving}
                  />
                  {item.personal_note?.trim() ? (
                    <Button
                      label={t('words.personalMeaningClear')}
                      variant="ghost"
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
            disabled={!selectedId || saving || loading}
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
  list: { flexGrow: 0 },
  loading: { alignItems: 'center', paddingVertical: 24 },
  optionHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});

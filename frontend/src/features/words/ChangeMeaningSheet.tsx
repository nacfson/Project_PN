import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { changeLearningItemSense, lookupWord } from '../../api/words';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Input, Text } from '../../ui';
import type { LearningItemListItem, SenseOption } from '../../types';
import { renderFormattedSentence } from '../../utils/text';
import { isClosestToContext } from '../../utils/senses';
import { SenseMeaning } from '../../components/SenseMeaning';

interface ChangeMeaningSheetProps {
  visible: boolean;
  item: LearningItemListItem;
  onClose: () => void;
  onChanged: (next: LearningItemListItem) => void;
}

export function ChangeMeaningSheet({ visible, item, onClose, onChanged }: ChangeMeaningSheetProps) {
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
  const [personalNote, setPersonalNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedId(item.word_sense_id);
    setOptions([]);
    setContext('');
    setPersonalNote(item.personal_note?.trim() ?? '');
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
  }, [visible, item.lemma, item.language_code, item.word_sense_id, item.personal_note, t]);

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
    const noteTrimmed = personalNote.trim();
    const priorNote = item.personal_note?.trim() ?? '';
    const senseUnchanged = selectedId === item.word_sense_id;
    const noteUnchanged = noteTrimmed === priorNote;
    if (senseUnchanged && noteUnchanged) {
      onClose();
      return;
    }
    setSaving(true);
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
    }
  }, [selectedId, personalNote, item, options, onChanged, onClose, t]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View
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
                disabled={finding || loading}
                loading={finding}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="muted">
                {t('add.myWordingLabel')}
              </Text>
              <Input
                value={personalNote}
                onChangeText={setPersonalNote}
                placeholder={t('add.myWordingPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                onClear={() => setPersonalNote('')}
              />
            </View>
          </ScrollView>

          <Button
            label={t('words.changeMeaningConfirm')}
            onPress={() => {
              void handleConfirm();
            }}
            disabled={!selectedId || saving || loading}
            loading={saving}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', paddingHorizontal: 20, paddingTop: 8 },
  dragHandle: { alignItems: 'center', paddingVertical: 8 },
  dragIndicator: { width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { flexGrow: 0 },
  loading: { alignItems: 'center', paddingVertical: 24 },
  optionHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});

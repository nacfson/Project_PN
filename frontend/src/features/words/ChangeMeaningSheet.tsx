import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { changeLearningItemSense, lookupWord } from '../../api/words';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Text } from '../../ui';
import type { LearningItemListItem, SenseOption } from '../../types';
import { renderFormattedSentence } from '../../utils/text';
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
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedId(item.word_sense_id);
    setOptions([]);
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
  }, [visible, item.lemma, item.language_code, item.word_sense_id, t]);

  const handleConfirm = useCallback(async () => {
    if (!selectedId || selectedId === item.word_sense_id) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await changeLearningItemSense(item.id, selectedId);
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
  }, [selectedId, item, options, onChanged, onClose, t]);

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

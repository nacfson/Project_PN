import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../i18n';
import type { TranslationKey } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Input, Text } from '../ui';
import type { PartOfSpeech, SenseOption } from '../types';
import { bestMatch, isClosestToContext } from '../utils/senses';
import { renderFormattedSentence } from '../utils/text';
import { SenseMeaning } from './SenseMeaning';

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
];

interface SensePickerProps {
  visible: boolean;
  query: string;
  options: SenseOption[];
  generating: boolean;
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

  useEffect(() => {
    if (suggestPosPrompt) {
      setPosPrompt(true);
    }
  }, [suggestPosPrompt]);

  const top = useMemo(() => bestMatch(options), [options]);
  const selected = options.find((o) => o.word_sense_id === selectedId) ?? null;
  const resolvedContext = (draftContext || sourceContext).trim();
  const showPosPrompt = posPrompt || suggestPosPrompt;

  const reset = () => {
    setSelectedId(null);
    setPosPrompt(false);
    setNeedContext(false);
    setDraftContext('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddSelected = () => {
    if (selectedId) {
      onConfirm(selectedId);
      reset();
    }
  };

  const handleAddBestMatch = () => {
    if (top) {
      onConfirm(top.word_sense_id);
      reset();
    }
  };

  const proceedForce = (context: string) => {
    onSourceContextChange?.(context);
    if (selected) {
      onForceExisting(selected.word_id, context);
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
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
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
            <Text variant="title">{t('sense.chooseMeaning', { query })}</Text>
            <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button">
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          {errorMessage && (
            <View style={[styles.errorRow, { backgroundColor: colors.errorContainer, marginBottom: spacing.sm }]}>
              <Icon name="alert-circle" size="sm" color={colors.error} />
              <Text variant="body" color="danger">
                {errorMessage}
              </Text>
            </View>
          )}

          <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            {options.length === 0 && !generating && (
              <Text color="muted" style={{ fontStyle: 'italic' }}>
                {t('sense.noneFound')}
              </Text>
            )}

            {options.map((option) => {
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
                      {option.cefr_level && <Badge label={option.cefr_level} variant="info" />}
                      {closest && <Badge label={t('sense.closestToContext')} variant="success" />}
                    </View>
                    <SenseMeaning option={option} />
                    {(option.examples ?? []).length > 0 && (
                      <Text variant="caption" color="muted" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
                        &ldquo;{renderFormattedSentence((option.examples ?? [])[0].sentence, query)}&rdquo;
                      </Text>
                    )}
                  </Card>
                </Pressable>
              );
            })}

            {generating && (
              <View style={[styles.generating, { gap: spacing.sm }]}>
                <ActivityIndicator color={colors.primary} />
                <Text color="muted">{t('sense.generating')}</Text>
              </View>
            )}

            {needContext && (
              <View style={[styles.posPrompt, { borderTopColor: colors.outlineVariant, paddingTop: spacing.md, gap: spacing.sm }]}>
                <Text variant="label" color="muted">
                  {t('sense.needContext')}
                </Text>
                <Input
                  value={draftContext}
                  onChangeText={setDraftContext}
                  placeholder={t('add.contextPlaceholder')}
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
                  disabled={!draftContext.trim() || generating}
                />
              </View>
            )}

            {showPosPrompt && !selected && (
              <View style={[styles.posPrompt, { borderTopColor: colors.outlineVariant, paddingTop: spacing.md, gap: spacing.md }]}>
                <Text variant="label" color="muted">
                  {t('sense.pickPartOfSpeech')}
                </Text>
                <View style={styles.posRow}>
                  {CONCRETE_POS.map((pos) => (
                    <Button
                      key={pos}
                      label={t(`pos.${pos}`)}
                      variant="tonal"
                      onPress={() => {
                        onForceWithPos(pos, resolvedContext || undefined);
                        setPosPrompt(false);
                      }}
                      style={styles.posChip}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.actions, { marginTop: spacing.md, gap: spacing.md }]}>
            <Button label={t('sense.noneMatch')} variant="ghost" onPress={handleNoneMatch} disabled={generating} />
            <Button label={t('sense.addBest')} variant="tonal" onPress={handleAddBestMatch} disabled={!top || generating} />
            <Button label={t('sense.add')} onPress={handleAddSelected} disabled={!selectedId || generating} />
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '85%',
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
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});

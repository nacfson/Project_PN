import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Text } from '../ui';
import type { PartOfSpeech, SenseOption } from '../types';
import { bestMatch } from '../utils/senses';

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
  onConfirm: (wordSenseId: string) => void;
  onForceExisting: (wordId: string) => void;
  onForceWithPos: (pos: PartOfSpeech) => void;
  onClose: () => void;
}

export function SensePicker({
  visible,
  query,
  options,
  generating,
  errorMessage,
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

  const top = useMemo(() => bestMatch(options), [options]);
  const selected = options.find((o) => o.word_sense_id === selectedId) ?? null;

  const reset = () => {
    setSelectedId(null);
    setPosPrompt(false);
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

  const handleNoneMatch = () => {
    if (selected) {
      onForceExisting(selected.word_id);
      return;
    }
    setPosPrompt(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(15, 23, 42, 0.5)' }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={[styles.header, { marginBottom: spacing.sm }]}>
            <Text variant="title">{t('sense.chooseMeaning', { query })}</Text>
            <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button">
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          {errorMessage && (
            <View style={[styles.errorRow, { backgroundColor: colors.dangerSurface, marginBottom: spacing.sm }]}>
              <Icon name="alert-circle" size="sm" color={colors.danger} />
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
              return (
                <Pressable
                  key={option.word_sense_id}
                  onPress={() => setSelectedId(option.word_sense_id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Card
                    style={{
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.infoSurface : colors.surface,
                      marginBottom: 0,
                    }}
                  >
                    <View style={[styles.optionHead, { gap: spacing.sm }]}>
                      <Badge label={option.part_of_speech} variant="primary" />
                      {option.cefr_level && <Badge label={option.cefr_level} variant="info" />}
                    </View>
                    <Text variant="body" style={{ marginTop: spacing.xs }}>
                      {option.definition}
                    </Text>
                    {option.examples.length > 0 && (
                      <Text variant="caption" color="muted" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
                        &ldquo;{option.examples[0].sentence}&rdquo;
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

            {posPrompt && !selected && (
              <View style={[styles.posPrompt, { borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.md }]}>
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
                        onForceWithPos(pos);
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
            <Button label={t('sense.addBest')} variant="secondary" onPress={handleAddBestMatch} disabled={!top || generating} />
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
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
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

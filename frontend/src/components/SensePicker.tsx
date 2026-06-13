import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PartOfSpeech, SenseOption } from '../types';

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
  // Adds the concrete word sense as a learning item.
  onConfirm: (wordSenseId: string) => void;
  // "None of these match" with an existing option selected: append a new sense
  // under that exact word/POS row.
  onForceExisting: (wordId: string) => void;
  // "None of these match" with nothing selected: a concrete POS is required.
  onForceWithPos: (pos: PartOfSpeech) => void;
  onClose: () => void;
}

function bestMatch(options: SenseOption[]): SenseOption | null {
  if (options.length === 0) {
    return null;
  }
  return options.reduce((best, current) =>
    current.meaning_order < best.meaning_order ? current : best,
  );
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
    // If an existing option is selected, force-append under that word/POS.
    if (selected) {
      onForceExisting(selected.word_id);
      return;
    }
    // Otherwise a concrete POS is required before forced generation.
    setPosPrompt(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose a meaning for &ldquo;{query}&rdquo;</Text>
            <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {options.length === 0 && !generating && (
              <Text style={styles.empty}>No senses found.</Text>
            )}

            {options.map((option) => {
              const active = option.word_sense_id === selectedId;
              return (
                <Pressable
                  key={option.word_sense_id}
                  onPress={() => setSelectedId(option.word_sense_id)}
                  style={[styles.option, active && styles.optionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.optionHead}>
                    <Text style={styles.pos}>{option.part_of_speech}</Text>
                    {option.cefr_level && <Text style={styles.cefr}>{option.cefr_level}</Text>}
                  </View>
                  <Text style={styles.definition}>{option.definition}</Text>
                  {option.examples.length > 0 && (
                    <Text style={styles.example}>{option.examples[0].sentence}</Text>
                  )}
                </Pressable>
              );
            })}

            {generating && (
              <View style={styles.generating}>
                <ActivityIndicator />
                <Text style={styles.generatingText}>Generating a new meaning...</Text>
              </View>
            )}

            {posPrompt && !selected && (
              <View style={styles.posPrompt}>
                <Text style={styles.posPromptLabel}>
                  Pick a part of speech to generate a new meaning:
                </Text>
                <View style={styles.posRow}>
                  {CONCRETE_POS.map((pos) => (
                    <Pressable
                      key={pos}
                      onPress={() => {
                        onForceWithPos(pos);
                        setPosPrompt(false);
                      }}
                      style={styles.posChip}
                      accessibilityRole="button"
                    >
                      <Text style={styles.posChipLabel}>{pos}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={handleNoneMatch}
              disabled={generating}
              style={[styles.secondaryButton, generating && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryLabel}>None of these match</Text>
            </Pressable>

            <Pressable
              onPress={handleAddBestMatch}
              disabled={!top || generating}
              style={[styles.secondaryButton, (!top || generating) && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryLabel}>Add best match</Text>
            </Pressable>

            <Pressable
              onPress={handleAddSelected}
              disabled={!selectedId || generating}
              style={[styles.primaryButton, (!selectedId || generating) && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryLabel}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
    paddingRight: 12,
  },
  close: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 10,
    paddingVertical: 8,
  },
  empty: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  option: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  optionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pos: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7c3aed',
    textTransform: 'uppercase',
  },
  cefr: {
    fontSize: 11,
    color: '#0891b2',
    fontWeight: '600',
  },
  definition: {
    fontSize: 15,
    color: '#1e293b',
  },
  example: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  generating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  generatingText: {
    color: '#64748b',
  },
  posPrompt: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    gap: 8,
  },
  posPromptLabel: {
    fontSize: 13,
    color: '#475569',
  },
  posRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  posChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  posChipLabel: {
    fontSize: 12,
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryLabel: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563eb',
  },
  primaryLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});

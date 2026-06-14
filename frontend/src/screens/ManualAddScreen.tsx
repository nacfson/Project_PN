import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PosSelector } from '../components/PosSelector';
import { WordChip } from '../components/WordChip';
import { useAddQueue } from '../hooks/useAddQueue';
import type { PosFilter } from '../types';

export function ManualAddScreen() {
  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [added, setAdded] = useState<string[]>([]);
  const { enqueue, statusOf } = useAddQueue();

  const submit = () => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      return;
    }

    enqueue(trimmed, pos);
    setAdded((prev) => [trimmed, ...prev.filter((entry) => entry !== trimmed)]);
    setWord('');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Word</Text>
        <TextInput
          value={word}
          onChangeText={setWord}
          placeholder="Type a word to add"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="search"
        />

        <Text style={styles.label}>Part of speech (optional)</Text>
        <PosSelector value={pos} onChange={setPos} />

        <TouchableOpacity
          onPress={submit}
          disabled={word.trim().length === 0}
          style={[styles.lookupButton, word.trim().length === 0 && styles.buttonDisabled]}
        >
          <Text style={styles.lookupLabel}>Look up</Text>
        </TouchableOpacity>

        {added.length > 0 && (
          <View style={styles.addedSection}>
            <Text style={styles.label}>Added</Text>
            <View style={styles.addedRow}>
              {added.map((w, index) => (
                <WordChip key={`${w}-${index}`} word={w} status={statusOf(w)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  lookupButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  lookupLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  addedSection: {
    marginTop: 20,
    gap: 8,
  },
  addedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

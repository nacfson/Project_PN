import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PosSelector } from '../components/PosSelector';
import { SensePicker } from '../components/SensePicker';
import { WordChip, type WordStatus } from '../components/WordChip';
import { useSenseFlow } from '../hooks/useSenseFlow';
import { TappablePassage } from '../components/TappablePassage';
import type { PosFilter } from '../types';

export function CaptureScreen() {
  const [passage, setPassage] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, WordStatus>>({});

  const queue = useRef<string[]>([]);
  const queueIndex = useRef(0);
  const currentWord = useRef<string | null>(null);

  const setStatus = useCallback((word: string, status: WordStatus) => {
    setStatuses((prev) => ({ ...prev, [word]: status }));
  }, []);

  const flowRef = useRef<ReturnType<typeof useSenseFlow> | null>(null);

  const advance = useCallback(() => {
    queueIndex.current += 1;
    const next = queue.current[queueIndex.current];
    if (next) {
      currentWord.current = next;
      setStatus(next, 'pending');
      void flowRef.current?.lookup(next, pos);
    } else {
      currentWord.current = null;
    }
  }, [pos, setStatus]);

  const onAdded = useCallback(() => {
    if (currentWord.current) {
      setStatus(currentWord.current, 'added');
    }
    advance();
  }, [advance, setStatus]);

  const onDismiss = useCallback(() => {
    if (currentWord.current && statuses[currentWord.current] !== 'added') {
      setStatus(currentWord.current, 'idle');
    }
    advance();
  }, [advance, setStatus, statuses]);

  const flow = useSenseFlow({ onAdded, onDismiss });
  flowRef.current = flow;

  const toggle = useCallback((word: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  }, []);

  const addSelected = () => {
    const words = Array.from(selected).filter((w) => statuses[w] !== 'added');
    if (words.length === 0) {
      return;
    }
    queue.current = words;
    queueIndex.current = 0;
    currentWord.current = words[0];
    words.forEach((w) => setStatus(w, 'pending'));
    void flow.lookup(words[0], pos);
  };

  const selectedList = Array.from(selected);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Passage</Text>
        <TextInput
          value={passage}
          onChangeText={setPassage}
          placeholder="Paste or type text here..."
          multiline
          style={styles.input}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Tap words to select</Text>
        <View style={styles.passageBox}>
          <TappablePassage text={passage} selected={selected} onToggle={toggle} />
        </View>

        <Text style={styles.label}>Part of speech (optional)</Text>
        <PosSelector value={pos} onChange={setPos} />

        {selectedList.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.label}>Selected ({selectedList.length})</Text>
            <View style={styles.chipRow}>
              {selectedList.map((w) => (
                <WordChip
                  key={w}
                  word={w}
                  status={statuses[w] ?? 'idle'}
                  onRemove={() => toggle(w)}
                />
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={addSelected}
          disabled={selected.size === 0}
          style={[styles.addButton, selected.size === 0 && styles.buttonDisabled]}
        >
          <Text style={styles.addLabel}>Add selected ({selected.size})</Text>
        </TouchableOpacity>
      </ScrollView>

      <SensePicker
        visible={flow.pickerVisible}
        query={flow.query}
        options={flow.options}
        generating={flow.generating}
        errorMessage={flow.error}
        onConfirm={flow.confirm}
        onForceExisting={flow.forceExisting}
        onForceWithPos={flow.forceWithPos}
        onClose={flow.close}
      />
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
    minHeight: 110,
  },
  passageBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
    minHeight: 60,
  },
  selectedSection: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});

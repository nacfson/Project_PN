import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Token {
  key: string;
  raw: string;
  word: string | null;
}

interface TappablePassageProps {
  text: string;
  selected: Set<string>;
  onToggle: (word: string) => void;
}

// Splits text into word/non-word tokens so punctuation and whitespace render
// inline while only actual words are tappable. Pure RN; identical on web,
// desktop, and mobile (no native text-selection API).
function tokenize(text: string): Token[] {
  const matches = text.match(/[\p{L}\p{N}]+(?:[''-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu);
  if (!matches) {
    return [];
  }
  return matches.map((raw, index) => {
    const isWord = /[\p{L}\p{N}]/u.test(raw);
    return {
      key: `${index}-${raw}`,
      raw,
      word: isWord ? raw.toLowerCase() : null,
    };
  });
}

export function TappablePassage({ text, selected, onToggle }: TappablePassageProps) {
  const tokens = useMemo(() => tokenize(text), [text]);

  if (tokens.length === 0) {
    return <Text style={styles.placeholder}>Type or paste a passage above, then tap words to add.</Text>;
  }

  return (
    <View style={styles.container}>
      {tokens.map((token) => {
        if (token.word === null) {
          return (
            <Text key={token.key} style={styles.separator}>
              {token.raw}
            </Text>
          );
        }
        const isSelected = selected.has(token.word);
        return (
          <Pressable
            key={token.key}
            onPress={() => onToggle(token.word as string)}
            style={[styles.wordChip, isSelected && styles.wordChipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.word, isSelected && styles.wordSelected]}>{token.raw}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  placeholder: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  separator: {
    fontSize: 16,
    color: '#1e293b',
  },
  wordChip: {
    borderRadius: 6,
    paddingHorizontal: 2,
    marginVertical: 1,
  },
  wordChipSelected: {
    backgroundColor: '#2563eb',
  },
  word: {
    fontSize: 16,
    color: '#1e293b',
  },
  wordSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

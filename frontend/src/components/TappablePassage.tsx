import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

interface Token {
  key: string;
  raw: string;
  word: string | null;
  /** Index among word tokens only (skips separators). */
  wordIndex: number | null;
}

interface TappablePassageProps {
  text: string;
  selected: Set<string>;
  onToggle: (word: string) => void;
}

function tokenize(text: string): Token[] {
  const matches = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu);
  if (!matches) {
    return [];
  }
  let wordIndex = 0;
  return matches.map((raw, index) => {
    const isWord = /[\p{L}\p{N}]/u.test(raw);
    const token: Token = {
      key: `${index}-${raw}`,
      raw,
      word: isWord ? raw.toLowerCase() : null,
      wordIndex: isWord ? wordIndex : null,
    };
    if (isWord) {
      wordIndex += 1;
    }
    return token;
  });
}

function phraseFromRange(tokens: Token[], start: number, end: number): string {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.wordIndex == null) continue;
    if (token.wordIndex >= lo && token.wordIndex <= hi && token.word) {
      parts.push(token.word);
    }
  }
  return parts.join(' ');
}

export function TappablePassage({ text, selected, onToggle }: TappablePassageProps) {
  const { colors, radii } = useTheme();
  const { t } = useAppLanguage();
  const tokens = useMemo(() => tokenize(text), [text]);
  const [anchor, setAnchor] = useState<number | null>(null);

  if (tokens.length === 0) {
    return (
      <Text color="muted" style={{ fontStyle: 'italic' }}>
        {t('add.emptyPassage')}
      </Text>
    );
  }

  const handleWordPress = (wordIndex: number, word: string) => {
    if (anchor == null) {
      setAnchor(wordIndex);
      onToggle(word);
      return;
    }
    if (anchor === wordIndex) {
      setAnchor(null);
      onToggle(word);
      return;
    }
    const phrase = phraseFromRange(tokens, anchor, wordIndex);
    setAnchor(null);
    if (phrase && !selected.has(phrase)) {
      onToggle(phrase);
    } else if (phrase && selected.has(phrase)) {
      onToggle(phrase);
    }
  };

  return (
    <View style={styles.container}>
      {tokens.map((token) => {
        if (token.word === null || token.wordIndex == null) {
          return (
            <Text key={token.key} style={[styles.separator, { color: colors.onSurface }]}>
              {token.raw}
            </Text>
          );
        }
        const isSelected = selected.has(token.word) || [...selected].some((item) => {
          const parts = item.split(/\s+/);
          return parts.includes(token.word as string) && parts.length > 1;
        });
        const isAnchor = anchor === token.wordIndex;
        return (
          <Pressable
            key={token.key}
            onPress={() => handleWordPress(token.wordIndex as number, token.word as string)}
            style={[
              styles.wordChip,
              {
                borderRadius: radii.sm,
                backgroundColor: isSelected || isAnchor ? colors.primaryContainer : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.word,
                { color: isSelected || isAnchor ? colors.onPrimaryContainer : colors.onSurface },
                (isSelected || isAnchor) && { fontWeight: '600' },
              ]}
            >
              {token.raw}
            </Text>
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
  separator: {
    fontSize: 16,
  },
  wordChip: {
    paddingHorizontal: 2,
    marginVertical: 1,
  },
  word: {
    fontSize: 16,
  },
});

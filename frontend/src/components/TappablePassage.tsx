import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

interface Token {
  key: string;
  raw: string;
  word: string | null;
  /** Index among word tokens only (null for separators). */
  wordIndex: number | null;
}

export interface PassageSpan {
  /** Inclusive word-token start index. */
  start: number;
  /** Inclusive word-token end index. */
  end: number;
  /** Normalized joined text, e.g. "look up". */
  text: string;
}

interface TappablePassageProps {
  text: string;
  selected: PassageSpan[];
  phraseMode?: boolean;
  /** Word index awaiting the end of a phrase span (phrase mode). */
  phraseAnchor?: number | null;
  onToggleSpan: (span: PassageSpan) => void;
  onPhraseAnchor: (wordIndex: number | null) => void;
}

export function tokenize(text: string): Token[] {
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

export function wordTokensOf(text: string): Array<{ wordIndex: number; word: string }> {
  return tokenize(text)
    .filter((t): t is Token & { word: string; wordIndex: number } => t.word !== null && t.wordIndex !== null)
    .map((t) => ({ wordIndex: t.wordIndex, word: t.word }));
}

export function spanFromWordRange(
  words: Array<{ wordIndex: number; word: string }>,
  start: number,
  end: number,
): PassageSpan {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const slice = words.filter((w) => w.wordIndex >= lo && w.wordIndex <= hi);
  return {
    start: lo,
    end: hi,
    text: slice.map((w) => w.word).join(' '),
  };
}

function spanContains(span: PassageSpan, wordIndex: number): boolean {
  return wordIndex >= span.start && wordIndex <= span.end;
}

export function TappablePassage({
  text,
  selected,
  phraseMode = false,
  phraseAnchor = null,
  onToggleSpan,
  onPhraseAnchor,
}: TappablePassageProps) {
  const { colors, radii } = useTheme();
  const { t } = useAppLanguage();
  const tokens = useMemo(() => tokenize(text), [text]);
  const words = useMemo(() => wordTokensOf(text), [text]);
  // Keep a ref so two rapid taps (start+end) work before React re-renders.
  const anchorRef = useRef<number | null>(phraseAnchor);
  anchorRef.current = phraseAnchor;

  if (tokens.length === 0) {
    return (
      <Text color="muted" style={{ fontStyle: 'italic' }}>
        {t('add.emptyPassage')}
      </Text>
    );
  }

  const handlePress = (wordIndex: number, word: string) => {
    if (phraseMode) {
      const anchor = anchorRef.current;
      if (anchor === null) {
        const existing = selected.find((s) => spanContains(s, wordIndex) && s.start !== s.end);
        if (existing) {
          onToggleSpan(existing);
          return;
        }
        anchorRef.current = wordIndex;
        onPhraseAnchor(wordIndex);
        return;
      }
      const span = spanFromWordRange(words, anchor, wordIndex);
      anchorRef.current = null;
      onToggleSpan(span);
      onPhraseAnchor(null);
      return;
    }

    const existing = selected.find((s) => s.start === wordIndex && s.end === wordIndex);
    if (existing) {
      onToggleSpan(existing);
      return;
    }
    onToggleSpan({ start: wordIndex, end: wordIndex, text: word });
  };

  return (
    <View style={styles.container}>
      {tokens.map((token) => {
        if (token.word === null || token.wordIndex === null) {
          return (
            <Text key={token.key} style={[styles.separator, { color: colors.onSurface }]}>
              {token.raw}
            </Text>
          );
        }
        const wordIndex = token.wordIndex;
        const isSelected = selected.some((s) => spanContains(s, wordIndex));
        const isAnchor = phraseMode && phraseAnchor === wordIndex;
        return (
          <Pressable
            key={token.key}
            onPress={() => handlePress(wordIndex, token.word as string)}
            style={[
              styles.wordChip,
              {
                borderRadius: radii.sm,
                backgroundColor: isSelected || isAnchor ? colors.primaryContainer : 'transparent',
                borderBottomWidth: isAnchor && !isSelected ? 2 : 0,
                borderBottomColor: colors.primary,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            testID={`passage-word-${wordIndex}`}
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

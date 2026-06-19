import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

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
  const { colors, radii } = useTheme();
  const { t } = useAppLanguage();
  const tokens = useMemo(() => tokenize(text), [text]);

  if (tokens.length === 0) {
    return (
      <Text color="muted" style={{ fontStyle: 'italic' }}>
        {t('add.emptyPassage')}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {tokens.map((token) => {
        if (token.word === null) {
          return (
            <Text key={token.key} style={[styles.separator, { color: colors.text }]}>
              {token.raw}
            </Text>
          );
        }
        const isSelected = selected.has(token.word);
        return (
          <Pressable
            key={token.key}
            onPress={() => onToggle(token.word as string)}
            style={[
              styles.wordChip,
              {
                borderRadius: radii.sm,
                backgroundColor: isSelected ? colors.primary : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.word, { color: isSelected ? colors.onPrimary : colors.text }, isSelected && { fontWeight: '600' }]}>
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

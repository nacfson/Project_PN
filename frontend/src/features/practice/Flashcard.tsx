import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppLanguage } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Icon, Text } from '../../ui';
import type { DueItem } from '../../types';
import { SpeakButton } from '../../components/SpeakButton';

interface FlashcardProps {
  item: DueItem;
  example: { sentence: string; localized_translation?: string | null } | null;
  blankedSentence: string;
  isFlipped: boolean;
  cardMode: 'typing' | 'flashcard';
  userAnswer: string;
  isPreviouslyFailed: boolean;
  onFlip: () => void;
}

function highlightWordInSentence(sentence: string, word: string): ReactNode[] {
  if (!sentence || !word) return [sentence];
  const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}[a-zA-Z]*\\b`, 'gi');
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  sentence.replace(regex, (match, offset) => {
    if (offset > lastIndex) {
      parts.push(sentence.slice(lastIndex, offset));
    }
    parts.push(
      <Text key={`match-${offset}`} bold>
        {match}
      </Text>
    );
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < sentence.length) {
    parts.push(sentence.slice(lastIndex));
  }
  return parts;
}

function uniqueText(value: string | null | undefined, original: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed === original?.trim()) return null;
  return trimmed;
}

export function Flashcard({
  item,
  example,
  blankedSentence,
  isFlipped,
  cardMode,
  userAnswer,
  isPreviouslyFailed,
  onFlip,
}: FlashcardProps) {
  const { colors, spacing, radii, shadows, motion, reduced } = useTheme();
  const { t } = useAppLanguage();

  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipScale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  // Animate flip whenever isFlipped changes.
  useEffect(() => {
    if (reduced) {
      flipAnim.setValue(isFlipped ? 180 : 0);
      flipScale.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(flipAnim, {
        toValue: isFlipped ? 180 : 0,
        ...motion.spring.bouncy,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(flipScale, {
          toValue: 0.97,
          ...motion.spring.bouncy,
          useNativeDriver: true,
        }),
        Animated.spring(flipScale, {
          toValue: 1,
          ...motion.spring.bouncy,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [isFlipped, flipAnim, flipScale, reduced, motion]);

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [0, 0, 1],
  });

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const handleFlip = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onFlip();
  };

  const cardStyle = {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...shadows.md,
  };
  const localizedDefinition = uniqueText(item.localized_definition, item.definition);
  const localizedExample = uniqueText(example?.localized_translation, example?.sentence);

  const renderFront = () => (
    <View style={styles.cardContent}>
      <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey).toUpperCase()} variant="primary" />
      {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
      {cardMode === 'flashcard' ? (
        <>
          <View style={[styles.wordRow, { gap: spacing.sm }]}>
            <Text variant="headline" style={styles.wordText}>
              {item.lemma}
            </Text>
            <SpeakButton language={item.language_code} text={item.lemma} />
          </View>
          {item.pronunciation && (
            <Text variant="caption" color="muted">
              {item.pronunciation}
            </Text>
          )}
          <View style={[styles.tapPrompt, { marginTop: spacing.lg }]}>
            <Icon name="finger-print" size="md" color={colors.primary} />
            <Text variant="caption" color="primary" bold>
              {t('practice.tapReveal')}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text variant="caption" color="muted" style={styles.promptLabel}>
            {t('practice.recallPrompt')}
          </Text>
          <Text variant="title" bold style={styles.definitionText}>
            {item.definition}
          </Text>
          {example ? (
            <Text variant="body" style={styles.clozeText}>
              &ldquo;{blankedSentence}&rdquo;
            </Text>
          ) : (
            <Text variant="body" color="muted" style={styles.clozePlaceholder}>
              {t('practice.noExample')}
            </Text>
          )}
        </>
      )}
    </View>
  );

  const renderBack = () => (
    <View style={styles.cardContent}>
      <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey).toUpperCase()} variant="primary" />
      {cardMode === 'typing' && (
        <View style={[styles.wordRow, { gap: spacing.sm }]}>
          <Text variant="headline" style={styles.wordText}>
            {item.lemma}
          </Text>
          <SpeakButton language={item.language_code} text={item.lemma} />
        </View>
      )}
      {cardMode === 'typing' && item.pronunciation && (
        <Text variant="caption" color="muted">
          {item.pronunciation}
        </Text>
      )}
      {cardMode === 'typing' && (
        <View
          style={[
            styles.answerResult,
            {
              borderColor: colors.outlineVariant,
              backgroundColor: colors.surfaceContainerHighest,
            },
          ]}
        >
          <Text variant="caption" color="muted">
            {t('practice.yourAnswer')}
          </Text>
          <Text variant="body" style={styles.answerResultText}>
            {userAnswer.trim().length > 0 ? userAnswer.trim() : t('practice.noAnswerGiven')}
          </Text>
        </View>
      )}
      <View style={[styles.section, { gap: spacing.xs }]}>
        <Text variant="caption" color="muted">
          {t('practice.definitionLabel')}
        </Text>
        <Text variant="body" style={styles.backDefinitionText}>
          {item.definition}
        </Text>
        {localizedDefinition && (
          <Text variant="body" color="muted" style={styles.backDefinitionText}>
            {localizedDefinition}
          </Text>
        )}
      </View>
      {example && (
        <View style={[styles.section, { gap: spacing.xs, marginTop: spacing.sm }]}>
          <Text variant="caption" color="muted">
            {t('practice.exampleLabel')}
          </Text>
          <Text variant="body" style={styles.exampleSentence}>
            &ldquo;{highlightWordInSentence(example.sentence, item.normalized_text)}&rdquo;
          </Text>
          {localizedExample && (
            <Text variant="caption" color="muted" style={styles.exampleTranslation}>
              {localizedExample}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [
              { scale: flipScale },
            ],
          },
        ]}
      >
        <Pressable
          disabled={isFlipped}
          onPress={handleFlip}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={({ pressed: p }) => [
            styles.pressable,
            {
              transform: [{ scale: (pressed || p) && !isFlipped ? 0.98 : 1 }],
            },
          ]}
          accessibilityRole={isFlipped ? undefined : 'button'}
          accessibilityLabel={isFlipped ? undefined : t('practice.tapReveal')}
        >
          <Animated.View
            style={[
              styles.face,
              cardStyle,
              {
                opacity: frontOpacity,
                transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
              },
            ]}
          >
            {renderFront()}
          </Animated.View>

          <Animated.View
            style={[
              styles.face,
              styles.backFace,
              cardStyle,
              {
                opacity: backOpacity,
                transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
              },
            ]}
          >
            {renderBack()}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 320,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    minHeight: 320,
  },
  pressable: {
    width: '100%',
    minHeight: 320,
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 24,
    backfaceVisibility: 'hidden',
  },
  backFace: {
    // Ensure back face starts rotated.
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  promptLabel: {
    textAlign: 'center',
  },
  definitionText: {
    textAlign: 'center',
    lineHeight: 26,
    marginVertical: 10,
  },
  clozeText: {
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
  clozePlaceholder: {
    fontStyle: 'italic',
    textAlign: 'center',
  },
  tapPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerResult: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  answerResultText: {
    fontWeight: '700',
  },
  backDefinitionText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    width: '100%',
    alignItems: 'center',
  },
  exampleSentence: {
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  exampleTranslation: {
    textAlign: 'center',
  },
});

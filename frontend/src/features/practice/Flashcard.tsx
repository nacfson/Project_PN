import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppLanguage } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Icon, Text } from '../../ui';
import type { Rating } from '../../ui';
import type { DueItem } from '../../types';
import { SpeakButton } from '../../components/SpeakButton';
import { renderFormattedSentence, renderBoldMarkdown, getPosColor, getPosBadgeVariant } from '../../utils/text';

interface FlashcardProps {
  item: DueItem;
  example: { sentence: string; localized_translation?: string | null } | null;
  blankedSentence: string;
  isFlipped: boolean;
  cardMode: 'typing' | 'flashcard';
  userAnswer: string;
  isPreviouslyFailed: boolean;
  onFlip: () => void;
  onRate?: (rating: Rating) => void;
}

const SWIPE_THRESHOLD = 96;
// RN Web has no native animated module; native driver only warns and falls back.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function uniqueText(value: string | null | undefined, original: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed === original?.trim()) return null;
  return trimmed;
}

/** Safe POS badge label — Anki import can persist `unknown`, and other unexpected POS values may lack i18n keys. */
function formatPosBadgeLabel(
  pos: string | null | undefined,
  t: (key: TranslationKey) => string,
): string {
  const fallback = (pos?.trim() || 'unknown').toUpperCase();
  if (!pos?.trim()) {
    return fallback;
  }
  const key = `pos.${pos}` as TranslationKey;
  const translated = t(key);
  // Missing keys: older `t` returned undefined; hardened `t` returns the key string.
  if (typeof translated !== 'string' || translated.length === 0 || translated === key) {
    return fallback;
  }
  return translated.toUpperCase();
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
  onRate,
}: FlashcardProps) {
  const { colors, spacing, radii, shadows, motion, reduced } = useTheme();
  const { t } = useAppLanguage();

  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipScale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [pressed, setPressed] = useState(false);
  const [swipeHint, setSwipeHint] = useState<Rating | null>(null);
  const hintRef = useRef<Rating | null>(null);
  const isFlippedRef = useRef(isFlipped);
  const onRateRef = useRef(onRate);

  const [frontHeight, setFrontHeight] = useState(320);
  const [backHeight, setBackHeight] = useState(320);

  isFlippedRef.current = isFlipped;
  onRateRef.current = onRate;

  const handleFrontLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setFrontHeight(height + 48); // add top + bottom padding of 24
    }
  };

  const handleBackLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setBackHeight(height + 48); // add top + bottom padding of 24
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [isFlipped]);

  // Reset swipe state when the card identity or flip state changes.
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    hintRef.current = null;
    setSwipeHint(null);
  }, [item.user_word_sense_id, isFlipped, pan]);

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
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.spring(flipScale, {
          toValue: 0.97,
          ...motion.spring.bouncy,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(flipScale, {
          toValue: 1,
          ...motion.spring.bouncy,
          useNativeDriver: USE_NATIVE_DRIVER,
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

  const ratingFromGesture = (dx: number, dy: number): Rating | null => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
      return null;
    }
    // Prefer the dominant axis so scroll-ish vertical moves don't mis-rate.
    if (absX >= absY) {
      return dx > 0 ? 'good' : 'again';
    }
    return dy < 0 ? 'easy' : 'hard';
  };

  const updateHint = (dx: number, dy: number) => {
    const hint = ratingFromGesture(dx, dy);
    if (hint !== hintRef.current) {
      hintRef.current = hint;
      setSwipeHint(hint);
      if (hint && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };

  const resetHint = () => {
    hintRef.current = null;
    setSwipeHint(null);
  };

  const springBack = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 8,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    resetHint();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!isFlippedRef.current || !onRateRef.current) {
          return false;
        }
        const { dx, dy } = gestureState;
        // Claim the gesture once movement is intentional so taps still flip/press.
        return Math.abs(dx) > 12 || Math.abs(dy) > 12;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        pan.setValue({ x: dx, y: dy });
        updateHint(dx, dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const rating = ratingFromGesture(gestureState.dx, gestureState.dy);
        if (rating && onRateRef.current) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          onRateRef.current(rating);
          return;
        }
        springBack();
      },
      onPanResponderTerminate: () => {
        springBack();
      },
    })
  ).current;

  const handleFlip = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onFlip();
  };

  const hintLabel: Record<Rating, string> = {
    again: t('practice.ratingForgot'),
    hard: t('practice.ratingHard'),
    good: t('practice.ratingGood'),
    easy: t('practice.ratingEasy'),
  };

  const hintColor: Record<Rating, string> = {
    again: '#b3261e',
    hard: '#d97706',
    good: '#16a34a',
    easy: '#6750a4',
  };

  const posColor = getPosColor(item.part_of_speech, colors);
  const badgeVariant = getPosBadgeVariant(item.part_of_speech);
  const posBadgeLabel = formatPosBadgeLabel(item.part_of_speech, t);

  const cardStyle = {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderTopWidth: 4,
    borderTopColor: posColor,
    ...shadows.md,
  };
  const localizedDefinition = uniqueText(item.localized_definition, item.definition);
  const localizedExample = uniqueText(example?.localized_translation, example?.sentence);

  const renderFront = () => (
    <View style={styles.cardContent}>
      <View onLayout={handleFrontLayout} style={{ width: '100%', alignItems: 'center', gap: 16 }}>
        <Badge label={posBadgeLabel} variant={badgeVariant} />
        {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
        {cardMode === 'flashcard' ? (
          <>
            <View style={[styles.wordRow, { gap: spacing.sm }]}>
              <Text variant="headline" style={[styles.wordText, { color: posColor }]}>
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
              {t('practice.typePrompt')}
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
    </View>
  );

  const renderBack = () => (
    <View style={styles.cardContent}>
      <View onLayout={handleBackLayout} style={{ width: '100%', alignItems: 'center', gap: 16 }}>
        <Badge label={posBadgeLabel} variant={badgeVariant} />
        {cardMode === 'typing' && (
          <View style={[styles.wordRow, { gap: spacing.sm }]}>
            <Text variant="headline" style={[styles.wordText, { color: posColor }]}>
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
          <Text variant="title" style={styles.backDefinitionText}>
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
              &ldquo;{renderFormattedSentence(example.sentence, item.normalized_text, posColor)}&rdquo;
            </Text>
            {localizedExample && (
              <Text variant="caption" color="muted" style={styles.exampleTranslation}>
                {renderBoldMarkdown(localizedExample, posColor)}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const currentHeight = Math.max(320, isFlipped ? backHeight : frontHeight);

  const rotate = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const panScale = pan.y.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0.96, 1, 0.96],
  });

  return (
    <View style={styles.wrapper}>
      <View testID="flashcard-3d-wrapper" style={[styles.container, { height: currentHeight }]}>
        {swipeHint && (
          <View style={styles.hintOverlay} pointerEvents="none">
            <View style={[styles.hintBadge, { backgroundColor: hintColor[swipeHint] }]}>
              <Text variant="title" bold style={{ color: '#fff' }}>
                {hintLabel[swipeHint]}
              </Text>
            </View>
          </View>
        )}

        <Animated.View
          style={[
            styles.cardContainer,
            {
              height: currentHeight,
              transform: [...pan.getTranslateTransform(), { rotate }, { scale: panScale }],
            },
          ]}
          {...(isFlipped && onRate ? panResponder.panHandlers : null)}
        >
          <Animated.View
            style={{
              height: currentHeight,
              transform: [{ scale: flipScale }],
            }}
          >
            <Pressable
              disabled={isFlipped}
              onPress={handleFlip}
              onPressIn={() => setPressed(true)}
              onPressOut={() => setPressed(false)}
              style={({ pressed: p }) => [
                styles.pressable,
                {
                  height: currentHeight,
                  transform: [{ scale: (pressed || p) && !isFlipped ? 0.98 : 1 }],
                },
              ]}
              accessibilityRole={isFlipped ? undefined : 'button'}
              accessibilityLabel={isFlipped ? undefined : t('practice.tapReveal')}
            >
              <Animated.View
                pointerEvents={isFlipped ? 'none' : 'auto'}
                style={[
                  styles.face,
                  cardStyle,
                  {
                    opacity: frontOpacity,
                    transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
                  },
                  Platform.OS === 'web' && isFlipped && { display: 'none' },
                ]}
              >
                {renderFront()}
              </Animated.View>

              <Animated.View
                pointerEvents={isFlipped ? 'auto' : 'none'}
                style={[
                  styles.face,
                  styles.backFace,
                  cardStyle,
                  {
                    opacity: backOpacity,
                    transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
                  },
                  Platform.OS === 'web' && !isFlipped && { display: 'none' },
                ]}
              >
                {renderBack()}
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>

      {isFlipped && onRate ? (
        <Text variant="caption" color="muted" style={styles.swipeGuide}>
          {t('practice.swipeGuide')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
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
  hintOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  hintBadge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  swipeGuide: {
    marginTop: 10,
    textAlign: 'center',
  },
});

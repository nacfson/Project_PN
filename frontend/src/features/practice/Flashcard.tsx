import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Icon, Text } from '../../ui';
import type { Rating } from '../../ui';
import type { DueItem } from '../../types';

interface FlashcardProps {
  item: DueItem;
  example: { sentence: string; localized_translation?: string | null } | null;
  blankedSentence: string;
  isFlipped: boolean;
  cardMode: 'typing' | 'flashcard';
  userAnswer: string;
  isPreviouslyFailed: boolean;
  onFlip: () => void;
  onRate: (rating: Rating) => void;
}

const SWIPE_THRESHOLD = 96;
const DIRECTION_THRESHOLD = 24;

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
  const { colors, spacing, radii, shadows } = useTheme();
  const { t } = useAppLanguage();

  const flipAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [swipeHint, setSwipeHint] = useState<Rating | null>(null);
  const [pressed, setPressed] = useState(false);
  const hintRef = useRef<Rating | null>(null);

  // Animate flip whenever isFlipped changes.
  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 180 : 0,
      duration: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnim]);

  // Reset pan when card data changes.
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    setSwipeHint(null);
    hintRef.current = null;
  }, [item.user_word_sense_id, pan]);

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

    // Require a dominant direction.
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
      return null;
    }
    if (absX > absY && absX < SWIPE_THRESHOLD) {
      return null;
    }
    if (absY > absX && absY < SWIPE_THRESHOLD) {
      return null;
    }

    if (absX > absY) {
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isFlipped,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isFlipped) {
          return false;
        }
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 8 || Math.abs(dy) > 8;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        pan.setValue({ x: dx, y: dy });
        updateHint(dx, dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const rating = ratingFromGesture(dx, dy);
        if (rating) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          onRate(rating);
          return;
        }
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 8,
          useNativeDriver: true,
        }).start();
        resetHint();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 8,
          useNativeDriver: true,
        }).start();
        resetHint();
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

  const cardStyle = {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...shadows.md,
  };

  const renderFront = () => (
    <View style={styles.cardContent}>
      <Badge label={item.part_of_speech.toUpperCase()} variant="primary" />
      {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
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
      {cardMode === 'flashcard' && (
        <View style={[styles.tapPrompt, { marginTop: spacing.lg }]}>
          <Icon name="finger-print" size="md" color={colors.primary} />
          <Text variant="caption" color="primary" bold>
            {t('practice.tapReveal')}
          </Text>
        </View>
      )}
    </View>
  );

  const renderBack = () => (
    <View style={styles.cardContent}>
      <Badge label={item.part_of_speech.toUpperCase()} variant="primary" />
      <Text variant="headline" style={styles.wordText}>
        {item.lemma}
      </Text>
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
      <Text variant="body" color="muted" style={styles.backDefinitionText}>
        {item.definition}
      </Text>
      {example && (
        <View style={[styles.exampleContainer, { gap: spacing.xs, marginTop: spacing.sm }]}>
          <Text variant="body" style={styles.exampleSentence}>
            &ldquo;{example.sentence}&rdquo;
          </Text>
          {example.localized_translation && (
            <Text variant="caption" color="muted" style={styles.exampleTranslation}>
              {example.localized_translation}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const rotate = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const scale = pan.y.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0.96, 1, 0.96],
  });

  const animatedStyle = {
    transform: [
      ...pan.getTranslateTransform(),
      { rotate },
      { scale },
    ],
  };

  return (
    <View style={styles.container}>
      {swipeHint && (
        <View style={styles.hintOverlay} pointerEvents="none">
          <View style={[styles.hintBadge, { backgroundColor: hintColor[swipeHint] }]}>
            <Text variant="title" bold style={{ color: '#fff' }}>
              {hintLabel[swipeHint]}
            </Text>
          </View>
        </View>
      )}

      <Animated.View style={[styles.cardContainer, animatedStyle]}>
        <Pressable
          onPress={handleFlip}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={({ pressed: p }) => [
            styles.pressable,
            {
              transform: [{ scale: pressed || p ? 0.98 : 1 }],
            },
          ]}
          {...panResponder.panHandlers}
          accessibilityRole="button"
          accessibilityLabel={t('practice.tapReveal')}
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

      <View style={[styles.guide, { marginTop: spacing.md }]}>
        <Icon name="swap-horizontal" size="sm" color={colors.onSurfaceVariant} />
        <Text variant="caption" color="muted">
          {t('practice.swipeGuide')}
        </Text>
      </View>
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
  exampleContainer: {
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  hintBadge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

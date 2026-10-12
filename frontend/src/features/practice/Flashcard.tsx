import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
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
import { getPosColor, getPosBadgeVariant } from '../../utils/text';
import { displayGloss } from '../../utils/meanings';

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
  /** Cap outer card height so sticky grade controls stay tappable on small viewports. */
  maxHeight?: number;
}

const SWIPE_THRESHOLD = 96;
const MIN_CARD_HEIGHT = 240;
const DEFAULT_CARD_HEIGHT = 320;
// RN Web has no native animated module; native driver only warns and falls back.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type SwipeRating = Extract<Rating, 'again' | 'good'>;

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
  example: _example,
  blankedSentence: _blankedSentence,
  isFlipped,
  cardMode,
  userAnswer,
  isPreviouslyFailed,
  onFlip,
  onRate,
  maxHeight,
}: FlashcardProps) {
  const { colors, spacing, radii, shadows, motion, reduced } = useTheme();
  const { t } = useAppLanguage();

  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipScale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [pressed, setPressed] = useState(false);
  const [swipeHint, setSwipeHint] = useState<SwipeRating | null>(null);
  const hintRef = useRef<SwipeRating | null>(null);
  const isFlippedRef = useRef(isFlipped);
  const onRateRef = useRef(onRate);

  const [frontHeight, setFrontHeight] = useState(DEFAULT_CARD_HEIGHT);
  const [backHeight, setBackHeight] = useState(DEFAULT_CARD_HEIGHT);

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

  // Horizontal-only: vertical pans belong to page/inner scroll (Hard/Easy via buttons).
  const ratingFromGesture = (dx: number, dy: number): SwipeRating | null => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < SWIPE_THRESHOLD || absX < absY) {
      return null;
    }
    return dx > 0 ? 'good' : 'again';
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
        // Claim only horizontal-dominant moves so vertical scroll still works.
        return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        pan.setValue({ x: dx, y: 0 });
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

  const hintLabel: Record<SwipeRating, string> = {
    again: t('practice.ratingForgot'),
    good: t('practice.ratingGood'),
  };

  const hintColor: Record<SwipeRating, string> = {
    again: '#b3261e',
    good: '#16a34a',
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
  const gloss = displayGloss(item);

  const contentHeight = Math.max(DEFAULT_CARD_HEIGHT, isFlipped ? backHeight : frontHeight);
  const cappedMax =
    maxHeight != null && Number.isFinite(maxHeight) ? Math.max(MIN_CARD_HEIGHT, maxHeight) : undefined;
  const currentHeight = cappedMax != null ? Math.min(contentHeight, cappedMax) : contentHeight;
  const needsInnerScroll = cappedMax != null && contentHeight > cappedMax;

  const frontBody = (
    <View onLayout={handleFrontLayout} style={styles.measureColumn}>
      <Badge label={posBadgeLabel} variant={badgeVariant} />
      {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
      {item.is_leech && <Badge label={t('practice.leechBadge')} variant="danger" />}
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
          {gloss ? (
            <Text variant="headline" bold style={[styles.definitionText, { color: posColor }]}>
              {gloss}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );

  const backBody = (
    <View onLayout={handleBackLayout} style={styles.measureColumn}>
      <Badge label={posBadgeLabel} variant={badgeVariant} />
      {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
      {item.is_leech && <Badge label={t('practice.leechBadge')} variant="danger" />}
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
      {gloss ? (
        <Text variant="headline" bold style={[styles.backDefinitionText, { color: posColor }]}>
          {gloss}
        </Text>
      ) : null}
      {item.personal_note?.trim() ? (
        <Text variant="caption" color="muted">
          {t('practice.yourMeaning')}
        </Text>
      ) : null}
    </View>
  );

  const renderFaceContent = (body: ReactNode) => {
    if (!needsInnerScroll) {
      return <View style={styles.cardContent}>{body}</View>;
    }
    return (
      <ScrollView
        style={styles.faceScroll}
        contentContainerStyle={styles.faceScrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        bounces
      >
        {body}
      </ScrollView>
    );
  };

  const rotate = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const panScale = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0.98, 1, 0.98],
  });

  return (
    <View style={styles.wrapper}>
      <View
        testID="flashcard-3d-wrapper"
        style={[styles.container, { height: currentHeight, minHeight: Math.min(DEFAULT_CARD_HEIGHT, currentHeight) }]}
      >
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
              minHeight: Math.min(DEFAULT_CARD_HEIGHT, currentHeight),
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
                  minHeight: Math.min(DEFAULT_CARD_HEIGHT, currentHeight),
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
                {renderFaceContent(frontBody)}
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
                {renderFaceContent(backBody)}
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
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
  },
  pressable: {
    width: '100%',
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
    overflow: 'hidden',
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
  faceScroll: {
    flex: 1,
    width: '100%',
  },
  faceScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 16,
  },
  measureColumn: {
    width: '100%',
    alignItems: 'center',
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
    fontSize: 22,
    lineHeight: 30,
  },
  hintOverlay: {
    ...StyleSheet.absoluteFill,
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

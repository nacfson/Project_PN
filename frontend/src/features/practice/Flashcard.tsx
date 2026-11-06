import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppLanguage } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { shellKind, shellLayout } from '../../navigation/shellKind';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Kbd, Text } from '../../ui';
import type { Rating } from '../../ui';
import type { DueItem } from '../../types';
import { SpeakButton } from '../../components/SpeakButton';
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

/** Safe POS label — Anki import can persist `unknown`, and other unexpected POS values may lack i18n keys. */
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
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isPhone = shellLayout(shellKind(Platform.OS, ua), width) === 'bottom';

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

  const padV = isPhone ? 32 : 48;
  const padH = isPhone ? 24 : 48;

  const handleFrontLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setFrontHeight(height + padV * 2);
    }
  };

  const handleBackLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setBackHeight(height + padV * 2);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [isFlipped]);

  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    hintRef.current = null;
    setSwipeHint(null);
  }, [item.user_word_sense_id, isFlipped, pan]);

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
    }),
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
    again: colors.danger,
    good: colors.success,
  };

  const posBadgeLabel = formatPosBadgeLabel(item.part_of_speech, t);

  const cardStyle = {
    backgroundColor: isFlipped ? colors.surfaceHighlight : colors.surface,
    borderRadius: radii.xxl,
    borderWidth: 2,
    borderColor: isFlipped ? colors.warningBright : colors.hairline,
    paddingVertical: padV,
    paddingHorizontal: padH,
    ...shadows.playful,
  };
  const gloss = displayGloss(item);

  const contentHeight = Math.max(DEFAULT_CARD_HEIGHT, isFlipped ? backHeight : frontHeight);
  const cappedMax =
    maxHeight != null && Number.isFinite(maxHeight) ? Math.max(MIN_CARD_HEIGHT, maxHeight) : undefined;
  const currentHeight = cappedMax != null ? Math.min(contentHeight, cappedMax) : contentHeight;
  const isLongGloss = (gloss?.length ?? 0) > 120;
  const needsInnerScroll = (cappedMax != null && contentHeight > cappedMax) || isLongGloss;

  const statusBadges =
    isPreviouslyFailed || item.is_leech ? (
      <View style={styles.badgeRow}>
        {isPreviouslyFailed ? <Badge label={t('practice.retrying')} variant="warning" /> : null}
        {item.is_leech ? <Badge label={t('practice.leechBadge')} variant="danger" /> : null}
      </View>
    ) : null;

  const wordHeader = (
    <View style={styles.wordHeader}>
      {statusBadges}
      <Text variant="caption" color="muted" style={styles.posCaption}>
        {posBadgeLabel}
      </Text>
      <Text
        variant="cardLemma"
        style={[
          styles.wordText,
          { fontSize: isPhone ? 46 : 62, lineHeight: isPhone ? 48 : 66 },
        ]}
      >
        {item.lemma}
      </Text>
      <View style={styles.ipaRow}>
        {item.pronunciation ? (
          <Text variant="ipa" color="muted" style={{ fontSize: isPhone ? 13 : 14 }}>
            {item.pronunciation}
          </Text>
        ) : null}
        <SpeakButton language={item.language_code} text={item.lemma} />
      </View>
    </View>
  );

  const frontBody = (
    <View onLayout={handleFrontLayout} style={styles.measureColumn}>
      {cardMode === 'flashcard' ? (
        <>
          {wordHeader}
          <View style={styles.revealButtonRow}>
            <View
              style={[
                styles.revealPill,
                {
                  backgroundColor: colors.brandPrimary,
                  borderRadius: radii.md,
                  shadowColor: colors.primaryHover,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 1,
                  shadowRadius: 0,
                },
              ]}
            >
              <Text role="display" style={[styles.revealPillText, { color: colors.onPrimary, fontWeight: '700', fontSize: 18 }]}>
                {t('practice.showAnswer')}
              </Text>
              {Platform.OS === 'web' && !isPhone ? (
                <Kbd color={colors.onPrimary}>Space</Kbd>
              ) : null}
            </View>
            <Text variant="caption" color="muted" style={styles.srOnly}>
              {t('practice.tapReveal')}
            </Text>
          </View>
        </>
      ) : (
        <>
          {statusBadges}
          <Text variant="caption" color="muted" style={styles.posCaption}>
            {posBadgeLabel}
          </Text>
          <Text variant="caption" color="muted" style={styles.promptLabel}>
            {t('practice.typePrompt')}
          </Text>
          {gloss ? (
            <Text
              variant="meaning"
              style={[styles.backDefinitionText, { fontSize: isPhone ? 24 : 28 }]}
            >
              {gloss}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );

  const backBody = (
    <View onLayout={handleBackLayout} style={styles.measureColumn}>
      {wordHeader}
      {cardMode === 'typing' ? (
        <View
          style={[
            styles.answerResult,
            {
              borderColor: colors.hairline,
              backgroundColor: colors.fill,
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
      ) : null}
      <View
        style={[
          styles.meaningSection,
          {
            borderTopColor: colors.hairline,
            paddingTop: isPhone ? 24 : 28,
          },
        ]}
      >
        {gloss ? (
          <Text
            variant="meaning"
            style={[
              styles.backDefinitionText,
              {
                fontSize: isPhone ? 24 : 28,
                lineHeight: isPhone ? 31 : 36,
              },
            ]}
          >
            {gloss}
          </Text>
        ) : null}
        {item.personal_note?.trim() ? (
          <Text variant="caption" color="muted">
            {t('practice.yourMeaning')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderFaceContent = (body: ReactNode, testID?: string) => {
    if (!needsInnerScroll) {
      return <View style={styles.cardContent}>{body}</View>;
    }
    return (
      <ScrollView
        testID={testID}
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
        style={[
          styles.container,
          { height: currentHeight, minHeight: Math.min(DEFAULT_CARD_HEIGHT, currentHeight) },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.deckGhostFar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.hairline,
              borderRadius: radii.card,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.deckGhostNear,
            {
              backgroundColor: colors.surface,
              borderColor: colors.hairline,
              borderRadius: radii.card,
            },
          ]}
        />
        {swipeHint && (
          <View style={styles.hintOverlay} pointerEvents="none">
            <View style={[styles.hintBadge, { backgroundColor: hintColor[swipeHint] }]}>
              <Text variant="title" bold style={{ color: colors.onPrimary }}>
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
                  transform: [{ scale: (pressed || p) && !isFlipped ? 0.99 : 1 }],
                },
              ]}
              accessibilityRole={isFlipped ? undefined : 'button'}
              accessibilityLabel={isFlipped ? undefined : t('practice.tapReveal')}
            >
              {!isFlipped ? (
                <Animated.View
                  pointerEvents="auto"
                  style={[
                    styles.face,
                    cardStyle,
                    {
                      opacity: frontOpacity,
                      transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
                    },
                  ]}
                >
                  {renderFaceContent(frontBody, 'flashcard-front-scroll')}
                </Animated.View>
              ) : (
                <Animated.View
                  pointerEvents="auto"
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
                  {renderFaceContent(backBody, 'flashcard-back-scroll')}
                </Animated.View>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>

      {isFlipped && onRate ? (
        <Text variant="caption" color="muted" style={[styles.swipeGuide, { marginTop: spacing.xs }]}>
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
  deckGhostNear: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 8,
    bottom: -6,
    borderWidth: 1,
    opacity: 0.85,
  },
  deckGhostFar: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 16,
    bottom: -12,
    borderWidth: 1,
    opacity: 0.55,
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
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  backFace: {},
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
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
    gap: 24,
  },
  measureColumn: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  wordHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  posCaption: {
    fontSize: 13,
    textAlign: 'center',
  },
  wordText: {
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  ipaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  revealButtonRow: {
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealPill: {
    height: 48,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  revealPillText: {
    fontSize: 15,
    fontWeight: '500',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  promptLabel: {
    textAlign: 'center',
  },
  meaningSection: {
    width: '100%',
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 14,
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
    fontWeight: '600',
  },
  backDefinitionText: {
    textAlign: 'center',
    fontWeight: '500',
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
    textAlign: 'center',
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { AnimatedProgressBar, Badge, Button, Card, EmptyState, ErrorState, Icon, LoadingState, RatingBar, Screen, Text } from '../../ui';
import type { Rating } from '../../ui';
import { isTauri } from '../../utils/platform';
import {
  getDueLearningItems,
  listLearningItems,
  recordBatchReviewAttempts,
} from '../../api/learningItems';
import type { DueItem, LearningItemListItem, ReviewAttemptParams } from '../../types';
import { Flashcard } from './Flashcard';
import { Confetti } from '../../components/Confetti';
import { CountUpText } from '../../components/CountUpText';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Practice'>;
type SessionMode = 'normal' | 'repeat';
type CardMode = 'typing' | 'flashcard';
type SessionStatus =
  | 'idle'
  | 'loading_due'
  | 'loading_repeat'
  | 'active'
  | 'submitting'
  | 'success'
  | 'error';

const ratingScores: Record<Rating, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

export function mapScoreToQuality(score: number): number {
  if (score < 1.0) {
    return score * 3.0;
  }
  return 3.0 + (score - 1.0) * 1.0;
}

function getBlankedSentence(sentence: string, word: string) {
  if (!sentence || !word) return sentence || '';
  const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}[a-zA-Z]*\\b`, 'gi');
  const blanked = sentence.replace(regex, '_____');
  if (blanked === sentence) {
    return sentence.replace(new RegExp(escaped, 'gi'), '_____');
  }
  return blanked;
}

function learningItemToDueItem(item: LearningItemListItem): DueItem {
  return {
    user_word_sense_id: item.id,
    word_sense_id: item.word_sense_id,
    word_id: item.word_id,
    language_code: item.language_code,
    lemma: item.lemma,
    normalized_text: item.normalized_text,
    part_of_speech: item.part_of_speech,
    pronunciation: item.pronunciation,
    display_language_code: item.display_language_code,
    definition: item.definition,
    short_definition: item.short_definition,
    localized_definition: item.localized_definition,
    localized_short_definition: item.localized_short_definition,
    cefr_level: item.cefr_level,
    meaning_order: item.meaning_order,
    learning_stage: item.learning_stage,
    due_at: item.due_at,
    examples: item.examples ?? [],
  };
}

export function decideCardMode(item: DueItem): CardMode {
  const flashcardProbabilityByStage: Record<string, number> = {
    new: 0,
    learning: 0,
    recognized: 0.5,
    recalled: 0.7,
    usable: 0.85,
    mastered: 0.95,
  };
  const flashcardProbability = flashcardProbabilityByStage[item.learning_stage] ?? 0;
  return Math.random() < flashcardProbability ? 'flashcard' : 'typing';
}

export function PracticeScreen() {
  const { colors, spacing, radii, shadows, motion, reduced } = useTheme();
  const { t } = useAppLanguage();
  const cardStartedAtRef = useRef(Date.now());
  const navigation = useNavigation<NavigationProp>();

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sessionMode, setSessionMode] = useState<SessionMode>('normal');
  const [cardMode, setCardMode] = useState<CardMode>('typing');
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [practiceState, setPracticeState] = useState<'prompt' | 'reveal' | 'grading'>('prompt');
  const [userAnswer, setUserAnswer] = useState('');
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [ratingScore, setRatingScore] = useState(2.0);
  const [showFeedback, setShowFeedback] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const [attempts, setAttempts] = useState<ReviewAttemptParams[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pendingRef = useRef<ReviewAttemptParams[]>([]);
  const flushingRef = useRef(false);

  const [exampleIndexMap, setExampleIndexMap] = useState<Record<string, number>>({});
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});
  const answerInputRef = useRef<TextInput>(null);
  const statusRef = useRef(status);

  const toggleFlip = () => {
    setIsFlipped(true);
    setPracticeState('reveal');
  };

  useEffect(() => {
    if (status === 'active' && !isFlipped && cardMode === 'typing') {
      answerInputRef.current?.focus();
    }
  }, [isFlipped, status, currentIndex, cardMode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const resetCardInteraction = useCallback(() => {
    cardStartedAtRef.current = Date.now();
    setIsFlipped(false);
    setPracticeState('prompt');
    setUserAnswer('');
    setResponseTimeMs(null);
    setRatingScore(2.0);
  }, []);

  const loadDueItems = useCallback(() => {
    setStatus('loading_due');
    setErrorMsg(null);
    setSessionMode('normal');
    getDueLearningItems()
      .then((items) => {
        setDueItems(items);
        if (items.length > 0) {
          setQueue([...items]);
          setCurrentIndex(0);
          setAttempts([]);
          setFailedMap({});
          setExampleIndexMap({});
          setCardMode(decideCardMode(items[0]));
          resetCardInteraction();
          setStatus('active');
        } else {
          setStatus('idle');
        }
      })
      .catch((err) => {
        console.error('Error fetching due reviews:', err);
        setErrorMsg(err.message || t('practice.loadDueFailed'));
        setStatus('idle');
      });
  }, [resetCardInteraction, t]);

  useFocusEffect(
    useCallback(() => {
      const currentStatus = statusRef.current;
      if (currentStatus !== 'active' && currentStatus !== 'success' && currentStatus !== 'submitting') {
        loadDueItems();
      }
    }, [loadDueItems])
  );

  const startRepeatSession = () => {
    setStatus('loading_repeat');
    setErrorMsg(null);
    listLearningItems({ limit: 100 })
      .then((res) => {
        const repeatItems = res.items.map(learningItemToDueItem);

        if (repeatItems.length > 0) {
          setSessionMode('repeat');
          setDueItems(repeatItems);
          setQueue(repeatItems);
          setCurrentIndex(0);
          setAttempts([]);
          setFailedMap({});
          setExampleIndexMap({});
          setCardMode(decideCardMode(repeatItems[0]));
          resetCardInteraction();
          setStatus('active');
        } else {
          setStatus('idle');
          setErrorMsg(t('practice.noReviewedWordsRepeat'));
        }
      })
      .catch((err) => {
        console.error('Error starting repeat review:', err);
        setErrorMsg(err.message || t('practice.repeatFailed'));
        setStatus('idle');
      });
  };

  const flushPending = useCallback(async () => {
    if (flushingRef.current || pendingRef.current.length === 0) {
      return;
    }

    flushingRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    const toFlush = pendingRef.current;
    pendingRef.current = [];

    try {
      const res = await recordBatchReviewAttempts(toFlush);
      setXpEarned((prev) => prev + res.xp_earned);
    } catch (err) {
      console.error('Error flushing review attempts:', err);
      pendingRef.current = [...toFlush, ...pendingRef.current];
      setSaveError(err instanceof Error ? err.message : t('practice.saveError'));
    } finally {
      flushingRef.current = false;
      setIsSaving(false);
      if (pendingRef.current.length > 0) {
        setTimeout(flushPending, 1500);
      }
    }
  }, [t]);

  const waitForPendingFlushes = useCallback(async () => {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (pendingRef.current.length > 0 || flushingRef.current) {
      await flushPending();
      if (pendingRef.current.length > 0 || flushingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }, [flushPending]);

  useEffect(() => {
    if (sessionMode === 'normal' && status === 'active' && queue.length > 0 && currentIndex === queue.length) {
      waitForPendingFlushes()
        .then(() => setStatus('success'))
        .catch((err) => {
          console.error('Error finishing session:', err);
          setErrorMsg(err instanceof Error ? err.message : t('practice.submitFailed'));
          setStatus('error');
        });
    }
  }, [currentIndex, queue.length, sessionMode, status, waitForPendingFlushes, t]);

  const selectGrade = (rating: Rating) => {
    const score = ratingScores[rating];
    setRatingScore(score);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    if (reduced) {
      confirmGrade(score);
      setShowFeedback(false);
      slideAnim.setValue(0);
      opacityAnim.setValue(1);
      return;
    }

    setShowFeedback(true);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: -500,
        useNativeDriver: true,
      }),
      Animated.spring(opacityAnim, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      confirmGrade(score);
      setShowFeedback(false);
      slideAnim.setValue(500);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          ...motion.spring.bouncy,
          useNativeDriver: true,
        }),
        Animated.spring(opacityAnim, {
          toValue: 1,
          ...motion.spring.bouncy,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const confirmGrade = (overrideScore?: number) => {
    const currentItem = queue[currentIndex];
    if (!currentItem) return;

    const finalScore = overrideScore ?? ratingScore;

    const examplesList = currentItem.examples || [];
    const activeExIndex = exampleIndexMap[currentItem.user_word_sense_id] ?? 0;
    const example = examplesList.length > 0 ? examplesList[activeExIndex] : null;
    const prompt = example
      ? getBlankedSentence(example.sentence, currentItem.normalized_text)
      : 'Definition: ' + currentItem.definition;

    let activityType: ReviewAttemptParams['activity_type'];
    let userAnswerValue: string | null;
    let responseTimeValue: number | null;

    if (cardMode === 'flashcard') {
      activityType = 'word_to_meaning';
      userAnswerValue = null;
      responseTimeValue = null;
    } else {
      activityType = example ? 'cloze' : 'meaning_to_word';
      userAnswerValue = userAnswer.trim().length > 0 ? userAnswer.trim() : null;
      responseTimeValue = responseTimeMs ?? Date.now() - cardStartedAtRef.current;
    }

    const attempt: ReviewAttemptParams = {
      user_word_sense_id: currentItem.user_word_sense_id,
      activity_type: activityType,
      prompt,
      user_answer: userAnswerValue,
      correct_answer: currentItem.normalized_text,
      is_correct: finalScore >= 0.75,
      rating_score: finalScore,
      response_time_ms: responseTimeValue,
      confidence_rating: null,
    };

    setAttempts((prev) => [...prev, attempt]);
    pendingRef.current.push(attempt);
    flushPending();

    const shouldRetry = finalScore < 0.75;
    const nextIndex = currentIndex + 1;

    if (shouldRetry) {
      setFailedMap((prev) => ({ ...prev, [currentItem.user_word_sense_id]: true }));
      if (examplesList.length > 1) {
        setExampleIndexMap((prev) => {
          const nextIdx = (activeExIndex + 1) % examplesList.length;
          return { ...prev, [currentItem.user_word_sense_id]: nextIdx };
        });
      }
    }

    const nextQueue = (() => {
      let q = shouldRetry ? [...queue, currentItem] : [...queue];
      if (sessionMode === 'repeat' && dueItems.length > 0 && nextIndex >= q.length) {
        q = [...q, ...dueItems];
      }
      return q;
    })();
    setQueue(nextQueue);

    const nextItem = nextQueue[nextIndex];
    if (nextItem) {
      setCardMode(decideCardMode(nextItem));
    }

    setCurrentIndex((prev) => prev + 1);
    resetCardInteraction();
  };

  const finishRepeatSession = () => {
    if (attempts.length === 0) {
      setXpEarned(0);
      setStatus('success');
      return;
    }
    setStatus('submitting');
    waitForPendingFlushes()
      .then(() => setStatus('success'))
      .catch((err) => {
        console.error('Error finishing repeat session:', err);
        setErrorMsg(err instanceof Error ? err.message : t('practice.submitFailed'));
        setStatus('error');
      });
  };

  const revealAnswer = (forgot = false) => {
    if (isFlipped) {
      return;
    }
    if (!forgot && userAnswer.trim().length === 0) {
      return;
    }
    if (forgot) {
      setUserAnswer('');
      setRatingScore(0);
    }
    setResponseTimeMs(Date.now() - cardStartedAtRef.current);
    setIsFlipped(true);
    setPracticeState('reveal');
  };

  if (status === 'loading_due' || status === 'loading_repeat') {
    return (
      <Screen padded>
        <LoadingState message={t('practice.preparing')} />
      </Screen>
    );
  }

  if (status === 'submitting') {
    return (
      <Screen padded>
        <LoadingState message={t('practice.syncing')} />
      </Screen>
    );
  }

  if (status === 'success') {
    return (
      <Screen padded>
        <Confetti active={true} />
        <View style={[styles.center, { gap: spacing.lg }]}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="checkmark-circle" size="xl" color={colors.primary} />
          </View>
          <Text variant="heading" color="primary" style={{ textAlign: 'center' }}>
            {t('practice.complete')}
          </Text>
          <Card elevated style={{ width: '100%', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" bold>
              {t('practice.xpEarned')}
            </Text>
            <Badge
              variant="primary"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text variant="caption" bold style={{ color: colors.onPrimaryContainer }}>+</Text>
              <CountUpText
                target={xpEarned}
                variant="caption"
                bold
                style={{ color: colors.onPrimaryContainer }}
              />
              <Text variant="caption" bold style={{ color: colors.onPrimaryContainer }}> XP</Text>
            </Badge>
            <Text color="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              {t('practice.progressSaved')}
            </Text>
          </Card>
          <Button
            label={t('practice.backHome')}
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('idle');
              navigation.navigate('Learn');
            }}
          />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen padded>
        <View style={[styles.center, { gap: spacing.lg }]}>
          <ErrorState
            title={t('practice.submissionFailed')}
            message={errorMsg || t('practice.saveError')}
          />
          <Button
            label={t('practice.retrySync')}
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('submitting');
              waitForPendingFlushes()
                .then(() => setStatus('success'))
                .catch((err) => {
                  console.error('Retry submission error:', err);
                  setErrorMsg(err instanceof Error ? err.message : t('practice.submitFailed'));
                  setStatus('error');
                });
            }}
          />
          <Button
            label={t('practice.discardProgress')}
            variant="ghost"
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('idle');
              navigation.navigate('Learn');
            }}
          />
        </View>
      </Screen>
    );
  }

  if (status === 'idle') {
    return (
      <Screen padded>
        <View style={[styles.center, { gap: spacing.lg }]}>
          <EmptyState
            icon="layers-outline"
            title={t('home.allCaughtUp')}
            message={t('practice.noDueMessage')}
          />

          {errorMsg && (
            <Text color="danger" style={{ textAlign: 'center' }}>
              {errorMsg}
            </Text>
          )}

          <Button
            label={t('practice.refreshDue')}
            iconLeft="refresh"
            style={{ width: '100%' }}
            onPress={loadDueItems}
          />

          <Button
            label={t('practice.studyAgain')}
            variant="outline"
            iconLeft="play"
            style={{ width: '100%' }}
            onPress={startRepeatSession}
          />
        </View>
      </Screen>
    );
  }

  const currentItem = queue[currentIndex];
  if (!currentItem) return null;

  const examplesList = currentItem.examples || [];
  const activeExIndex = exampleIndexMap[currentItem.user_word_sense_id] ?? 0;
  const example = examplesList.length > 0 ? examplesList[activeExIndex] : null;
  const isPreviouslyFailed = failedMap[currentItem.user_word_sense_id] ?? false;
  const trimmedAnswer = userAnswer.trim();
  const currentPoolIndex = Math.max(
    0,
    dueItems.findIndex((item) => item.user_word_sense_id === currentItem.user_word_sense_id)
  );
  const displayCurrent = sessionMode === 'repeat' ? currentPoolIndex + 1 : currentIndex + 1;
  const displayTotal = sessionMode === 'repeat' ? dueItems.length : queue.length;

  const dueItemIDs = new Set(dueItems.map((item) => item.user_word_sense_id));
  const dueItemsReviewedCount =
    sessionMode === 'repeat'
      ? new Set(attempts.filter((att) => dueItemIDs.has(att.user_word_sense_id)).map((att) => att.user_word_sense_id)).size
      : attempts.filter((att) => dueItemIDs.has(att.user_word_sense_id)).length;
  const progressPercent =
    dueItems.length > 0
      ? Math.min(100, Math.floor((dueItemsReviewedCount / dueItems.length) * 100))
      : 0;

  const blankedSentence = example ? getBlankedSentence(example.sentence, currentItem.normalized_text) : '';

  const showAnswerBar = cardMode === 'typing' && !isFlipped;
  const answerBarHeight = 144;

  const answerBar = showAnswerBar ? (
    <View
      style={[
        styles.answerBar,
        {
          borderTopColor: colors.outlineVariant,
          backgroundColor: colors.surface,
          paddingBottom: spacing.lg,
        },
      ]}
    >
      <Text variant="label" color="muted">
        {t('practice.yourAnswer')}
      </Text>
      <TextInput
        ref={answerInputRef}
        value={userAnswer}
        onChangeText={setUserAnswer}
        placeholder={t('practice.answerPlaceholder')}
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => revealAnswer(false)}
        style={[
          styles.answerInput,
          {
            borderColor: colors.primary,
            backgroundColor: colors.surfaceContainerHighest,
            color: colors.onSurface,
          },
        ]}
      />
      <View style={[styles.revealActions, { gap: spacing.sm }]}>
        <Button
          label={t('practice.revealAnswer')}
          disabled={trimmedAnswer.length === 0}
          style={styles.revealButton}
          onPress={() => revealAnswer(false)}
        />
        <Button
          label={t('practice.dontKnow')}
          variant="outline"
          style={styles.revealButton}
          onPress={() => revealAnswer(true)}
        />
      </View>
    </View>
  ) : null;

  return (
    <Screen padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            showAnswerBar && { paddingBottom: answerBarHeight + spacing.md },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.progressHeader, { gap: spacing.sm }]}>
            <View style={styles.progressTextRow}>
              <Text variant="caption" color="muted">
                {t('practice.cardProgress', { current: displayCurrent, total: displayTotal })}
              </Text>
              <View style={styles.saveIndicator}>
                {isSaving && (
                  <>
                    <ActivityIndicator size="small" color={colors.onSurfaceVariant} />
                    <Text variant="caption" color="muted">
                      {t('practice.syncing')}
                    </Text>
                  </>
                )}
                {!isSaving && saveError && (
                  <>
                    <Icon name="warning-outline" size="sm" color={colors.error} />
                    <Text variant="caption" color="danger">
                      {t('practice.saveError')}
                    </Text>
                  </>
                )}
              </View>
              {sessionMode === 'repeat' && <Badge label={t('practice.repeatMode')} variant="primary" />}
              {cardMode === 'flashcard' && <Badge label={t('practice.flashcardMode')} variant="info" />}
              {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
            </View>
            <AnimatedProgressBar percent={progressPercent} height={6} />
          </View>

          <Animated.View style={{ transform: [{ translateX: slideAnim }], opacity: opacityAnim, width: '100%', position: 'relative' }}>
            <Flashcard
              key={currentItem.user_word_sense_id}
              item={currentItem}
              example={example}
              blankedSentence={blankedSentence}
              isFlipped={isFlipped}
              cardMode={cardMode}
              userAnswer={userAnswer}
              isPreviouslyFailed={isPreviouslyFailed}
              onFlip={toggleFlip}
            />
            {showFeedback && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: colors.surfaceContainer,
                    opacity: 0.95,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                  },
                ]}
              >
                <Icon name="checkmark-circle-outline" size="xl" color={colors.primary} />
                <Text variant="title" bold style={{ marginTop: spacing.sm }} color="primary">
                  {t('practice.saved')}
                </Text>
              </View>
            )}
          </Animated.View>

          {isFlipped && practiceState === 'reveal' && (
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
              <Button
                testID="btn-show-grading"
                label={t('practice.showRatingOptions')}
                iconRight="arrow-forward"
                onPress={() => setPracticeState('grading')}
                style={{ width: '100%' }}
              />
            </View>
          )}

          {isFlipped && practiceState === 'grading' && (
            <View
              style={[
                styles.gradingPanel,
                {
                  gap: spacing.md,
                  borderTopColor: colors.outlineVariant,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text variant="caption" color="muted" style={{ textAlign: 'center' }} bold>
                {t('practice.rateRecall')}
              </Text>
              <RatingBar
                intervals={currentItem.preview_intervals}
                onSelect={selectGrade}
              />
              {sessionMode === 'repeat' && (
                <Button
                  label={t('practice.finishRepeat')}
                  variant="outline"
                  style={{ width: '100%' }}
                  onPress={finishRepeatSession}
                />
              )}
            </View>
          )}
          {sessionMode === 'repeat' && !isFlipped && (
            <Button
              label={t('practice.finishRepeat')}
              variant="ghost"
              style={{ width: '100%', marginTop: spacing.md }}
              onPress={finishRepeatSession}
            />
          )}
        </ScrollView>

        {answerBar}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: {
    width: '100%',
    marginBottom: 20,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  flex: {
    flex: 1,
  },
  answerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  answerInput: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  revealActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revealButton: {
    flex: 1,
  },
  gradingPanel: {
    width: '100%',
    marginTop: 18,
    paddingTop: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 'auto',
    marginLeft: 8,
  },
});

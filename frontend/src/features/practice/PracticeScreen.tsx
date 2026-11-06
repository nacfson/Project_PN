import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import {
  AnimatedProgressBar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PageColumn,
  RatingBar,
  Screen,
  Text,
  useShellChrome,
} from '../../ui';
import type { Rating } from '../../ui';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import {
  getDueLearningItems,
  listLearningItems,
  recordBatchReviewAttempts,
} from '../../api/learningItems';
import { ApiError } from '../../api/client';
import { getReviewSettings } from '../../api/reviewSettings';
import type { DueItem, LearningItemListItem, ReviewAttemptParams, ReviewSettings } from '../../types';
import { Flashcard } from './Flashcard';
import { Confetti } from '../../components/Confetti';
import { CountUpText } from '../../components/CountUpText';
import { ChangeMeaningSheet } from '../words/ChangeMeaningSheet';
import {
  applyDueItemUpdatesToList,
  insertRetryCard,
  isPassingScore,
  optimisticDueItemAfterAgain,
  overridesFromBatchUpdates,
  resolveDueItem,
  sessionProgress,
  shufflePracticeQueue,
} from './practiceItemState';
import { analytics } from '../../analytics/analytics';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Practice'>;
type SessionMode = 'normal' | 'repeat';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
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
    personal_note: item.personal_note,
    lapse_count: item.lapse_count,
    is_leech: item.is_leech,
    examples: item.examples ?? [],
  };
}

export function dueItemToListItem(item: DueItem): LearningItemListItem {
  return {
    id: item.user_word_sense_id,
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
    added_at: item.due_at,
    personal_note: item.personal_note,
    lapse_count: item.lapse_count,
    is_leech: item.is_leech,
    examples: item.examples ?? [],
  };
}

export function failedMapFromDueItems(items: DueItem[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const item of items) {
    if (item.learning_stage === 'learning') {
      next[item.user_word_sense_id] = true;
    }
  }
  return next;
}

export function decideCardMode(item: DueItem): CardMode {
  const flashcardProbabilityByStage: Record<string, number> = {
    new: 1,
    learning: 1,
    recognized: 1,
    recalled: 1,
    usable: 1,
    mastered: 1,
  };
  const flashcardProbability = flashcardProbabilityByStage[item.learning_stage] ?? 1;
  return Math.random() < flashcardProbability ? 'flashcard' : 'typing';
}

export function PracticeScreen() {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { setChromeHidden } = useShellChrome();
  const cardStartedAtRef = useRef(Date.now());
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<MainTabParamList, 'Practice'>>();
  const scopedDeckId = route.params?.deckId?.trim() || undefined;
  const scopedOrigin = 'private' as const;

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sessionMode, setSessionMode] = useState<SessionMode>('normal');
  const [cardMode, setCardMode] = useState<CardMode>('typing');
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [, setPracticeState] = useState<'prompt' | 'reveal' | 'grading'>('prompt');
  const [userAnswer, setUserAnswer] = useState('');
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [ratingScore, setRatingScore] = useState(2.0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const [attempts, setAttempts] = useState<ReviewAttemptParams[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionStuck, setSessionStuck] = useState<Record<string, DueItem>>({});
  const [changeMeaningItem, setChangeMeaningItem] = useState<LearningItemListItem | null>(null);
  const [preferPersonalNote, setPreferPersonalNote] = useState(false);

  const pendingRef = useRef<ReviewAttemptParams[]>([]);
  const flushingRef = useRef(false);
  const currentIndexRef = useRef(0);

  const [exampleIndexMap, setExampleIndexMap] = useState<Record<string, number>>({});
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});
  const [itemOverrides, setItemOverrides] = useState<Record<string, Partial<DueItem>>>({});
  const [reviewSettings, setReviewSettings] = useState<ReviewSettings | null>(null);
  const answerInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const statusRef = useRef(status);
  const { height: windowHeight } = useWindowDimensions();
  const [measuredGradingBarHeight, setMeasuredGradingBarHeight] = useState(0);
  const [measuredAnswerBarHeight, setMeasuredAnswerBarHeight] = useState(0);

  // Focus mode: hide shell chrome while a session is active, and restore it on status change or unmount.
  useEffect(() => {
    setChromeHidden(status === 'active');
  }, [status, setChromeHidden]);

  useEffect(() => {
    return () => {
      setChromeHidden(false);
    };
  }, [setChromeHidden]);

  const toggleFlip = () => {
    if (cardMode === 'typing' && !isFlipped) {
      return;
    }
    setIsFlipped(true);
    const item = queue[currentIndex];
    if (item) {
      analytics.track('card_revealed', {
        learning_item_id: item.user_word_sense_id,
        lemma: item.lemma,
        mode: cardMode,
      });
    }
    setPracticeState('grading');
  };

  useEffect(() => {
    if (status === 'active' && !isFlipped && cardMode === 'typing') {
      answerInputRef.current?.focus();
    }
  }, [isFlipped, status, currentIndex, cardMode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (status !== 'active') return;
    slideAnim.setValue(80);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [currentIndex, status, slideAnim, opacityAnim]);

  const resetCardInteraction = useCallback(() => {
    cardStartedAtRef.current = Date.now();
    setIsFlipped(false);
    setPracticeState('prompt');
    setUserAnswer('');
    setResponseTimeMs(null);
    setRatingScore(2.0);
  }, []);

  useEffect(() => {
    getReviewSettings()
      .then(setReviewSettings)
      .catch(() => setReviewSettings(null));
  }, []);

  const applyDueItemUpdates = useCallback((updates: Parameters<typeof overridesFromBatchUpdates>[0]) => {
    if (updates.length === 0) {
      return;
    }
    const overrides = overridesFromBatchUpdates(updates);
    setItemOverrides((prev) => ({ ...prev, ...overrides }));
    setDueItems((prev) => applyDueItemUpdatesToList(prev, updates));
    setQueue((prev) => {
      const nextQueue = applyDueItemUpdatesToList(prev, updates, {
        preserveIndexesBefore: currentIndexRef.current,
      });
      setSessionStuck((stuckPrev) => {
        const nextStuck = { ...stuckPrev };
        for (const update of updates) {
          if (update.suspended || !(update.leech || update.is_leech)) {
            continue;
          }
          const found =
            nextQueue.find((item) => item.user_word_sense_id === update.user_word_sense_id) ??
            prev.find((item) => item.user_word_sense_id === update.user_word_sense_id);
          if (found) {
            nextStuck[update.user_word_sense_id] = {
              ...found,
              is_leech: true,
              lapse_count: update.lapse_count ?? found.lapse_count,
            };
          }
        }
        return nextStuck;
      });
      return nextQueue;
    });
    setFailedMap((prev) => {
      const next = { ...prev };
      for (const update of updates) {
        if (update.suspended) {
          delete next[update.user_word_sense_id];
          continue;
        }
        if (update.learning_stage === 'learning') {
          next[update.user_word_sense_id] = true;
        }
      }
      return next;
    });
  }, []);

  const openChangeMeaning = useCallback((item: DueItem, preferPersonal: boolean) => {
    setPreferPersonalNote(preferPersonal);
    setChangeMeaningItem(dueItemToListItem(item));
  }, []);

  const handleMeaningChanged = useCallback((next: LearningItemListItem) => {
    const duePatch: Partial<DueItem> = {
      word_sense_id: next.word_sense_id,
      definition: next.definition,
      short_definition: next.short_definition,
      localized_definition: next.localized_definition,
      localized_short_definition: next.localized_short_definition,
      examples: next.examples,
      meaning_order: next.meaning_order,
      personal_note: next.personal_note,
      is_leech: next.is_leech,
      lapse_count: next.lapse_count,
    };
    const id = next.id;
    setItemOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...duePatch },
    }));
    setQueue((prev) =>
      prev.map((item) =>
        item.user_word_sense_id === id ? { ...item, ...duePatch } : item,
      ),
    );
    setDueItems((prev) =>
      prev.map((item) =>
        item.user_word_sense_id === id ? { ...item, ...duePatch } : item,
      ),
    );
    setSessionStuck((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...duePatch } };
    });
    setChangeMeaningItem(null);
  }, []);

  const loadDueItems = useCallback(() => {
    setStatus('loading_due');
    setErrorMsg(null);
    setSessionMode('normal');
    getDueLearningItems(undefined, scopedDeckId, scopedOrigin)
      .then((items) => {
        if (items.length > 0) {
          const shuffled = shufflePracticeQueue(items);
          const first = shuffled[0];
          if (!first) {
            setDueItems([]);
            setQueue([]);
            setStatus('idle');
            return;
          }
          setDueItems(shuffled);
          setQueue([...shuffled]);
          setCurrentIndex(0);
          setAttempts([]);
          setItemOverrides({});
          setFailedMap(failedMapFromDueItems(shuffled));
          setSessionStuck({});
          setExampleIndexMap({});
          setCardMode(decideCardMode(first));
          resetCardInteraction();
          setStatus('active');
        } else {
          setDueItems([]);
          setQueue([]);
          setStatus('idle');
        }
      })
      .catch((err) => {
        console.error('Error fetching due reviews:', err);
        setErrorMsg(err.message || t('practice.loadDueFailed'));
        setStatus('idle');
      });
  }, [resetCardInteraction, scopedDeckId, scopedOrigin, t]);

  useFocusEffect(
    useCallback(() => {
      const currentStatus = statusRef.current;
      if (currentStatus !== 'active' && currentStatus !== 'submitting') {
        loadDueItems();
      }
    }, [loadDueItems]),
  );

  const startRepeatSession = () => {
    setStatus('loading_repeat');
    setErrorMsg(null);
    listLearningItems({ limit: 100, deckId: scopedDeckId, origin: scopedOrigin })
      .then((res) => {
        const repeatItems = res.items.map(learningItemToDueItem);

        if (repeatItems.length > 0) {
          const shuffled = shufflePracticeQueue(repeatItems);
          const first = shuffled[0];
          if (!first) {
            setDueItems([]);
            setQueue([]);
            setStatus('idle');
            setErrorMsg(t('practice.noReviewedWordsRepeat'));
            return;
          }
          setSessionMode('repeat');
          setDueItems(shuffled);
          setQueue(shuffled);
          setCurrentIndex(0);
          setAttempts([]);
          setItemOverrides({});
          setFailedMap(failedMapFromDueItems(shuffled));
          setSessionStuck({});
          setExampleIndexMap({});
          setCardMode(decideCardMode(first));
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
    const traceId = analytics.track('command_invoked', {
      command: 'review_submit',
      attempt_count: toFlush.length,
    });

    try {
      const res = await recordBatchReviewAttempts(toFlush, traceId);
      analytics.track(
        'review_succeeded',
        { attempt_count: toFlush.length, xp_earned: res.xp_earned },
        traceId,
      );
      setXpEarned((prev) => prev + res.xp_earned);
      if (res.updated_items?.length) {
        applyDueItemUpdates(res.updated_items);
      }
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : err &&
              typeof err === 'object' &&
              typeof (err as { status?: unknown }).status === 'number'
            ? (err as ApiError)
            : null;
      const retryable =
        apiErr == null ? true : apiErr.status === 0 || apiErr.retryable === true;

      analytics.track(
        'review_failed',
        {
          attempt_count: toFlush.length,
          error_code: apiErr?.code || 'UNKNOWN',
          retryable,
        },
        traceId,
      );
      console.error('Error flushing review attempts:', err);

      if (retryable) {
        pendingRef.current = [...toFlush, ...pendingRef.current];
        setSaveError(err instanceof Error ? err.message : t('practice.saveError'));
      } else {
        const unavailableIds = new Set(toFlush.map((attempt) => attempt.user_word_sense_id));
        const preserveBefore = currentIndexRef.current;
        setQueue((prev) =>
          prev.filter(
            (item, idx) => idx < preserveBefore || !unavailableIds.has(item.user_word_sense_id),
          ),
        );
        setFailedMap((prev) => {
          const next = { ...prev };
          for (const id of unavailableIds) {
            delete next[id];
          }
          return next;
        });
        setSaveError(err instanceof Error ? err.message : t('practice.saveError'));
      }
    } finally {
      flushingRef.current = false;
      setIsSaving(false);
      if (pendingRef.current.length > 0) {
        setTimeout(flushPending, 1500);
      }
    }
  }, [applyDueItemUpdates, t]);

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
    if (sessionMode !== 'normal' || status !== 'active') {
      return;
    }
    const finishedQueue =
      (queue.length > 0 && currentIndex >= queue.length) ||
      (queue.length === 0 && currentIndexRef.current > 0 && attempts.length > 0);
    if (!finishedQueue) {
      return;
    }
    waitForPendingFlushes()
      .then(() => setStatus('success'))
      .catch((err) => {
        console.error('Error finishing session:', err);
        setErrorMsg(err instanceof Error ? err.message : t('practice.submitFailed'));
        setStatus('error');
      });
  }, [attempts.length, currentIndex, queue.length, sessionMode, status, waitForPendingFlushes, t]);

  const selectGrade = (rating: Rating) => {
    const score = ratingScores[rating];
    const item = queue[currentIndex];
    if (item) {
      analytics.track('card_rated', {
        learning_item_id: item.user_word_sense_id,
        lemma: item.lemma,
        rating,
        score,
      });
    }
    setRatingScore(score);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    confirmGrade(score);
  };

  const confirmGrade = (overrideScore?: number) => {
    const rawItem = queue[currentIndex];
    if (!rawItem) return;
    const currentItem = resolveDueItem(rawItem, itemOverrides);

    const finalScore = overrideScore ?? ratingScore;

    if (currentItem.is_leech) {
      setSessionStuck((prev) => ({
        ...prev,
        [currentItem.user_word_sense_id]: currentItem,
      }));
    }

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

    const passed = isPassingScore(finalScore);
    const attempt: ReviewAttemptParams = {
      user_word_sense_id: currentItem.user_word_sense_id,
      activity_type: activityType,
      prompt,
      user_answer: userAnswerValue,
      correct_answer: currentItem.normalized_text,
      is_correct: passed,
      rating_score: finalScore,
      response_time_ms: responseTimeValue,
      confidence_rating: null,
    };

    setAttempts((prev) => [...prev, attempt]);
    pendingRef.current.push(attempt);
    const nextIndex = currentIndex + 1;
    currentIndexRef.current = nextIndex;
    flushPending();

    const shouldRetry = !isPassingScore(finalScore);

    let gradedItem = currentItem;
    if (shouldRetry) {
      gradedItem = optimisticDueItemAfterAgain(currentItem, reviewSettings);
      setItemOverrides((prev) => ({
        ...prev,
        [currentItem.user_word_sense_id]: {
          learning_stage: gradedItem.learning_stage,
          preview_intervals: gradedItem.preview_intervals,
        },
      }));
      setFailedMap((prev) => ({ ...prev, [currentItem.user_word_sense_id]: true }));
      if (examplesList.length > 1) {
        setExampleIndexMap((prev) => {
          const nextIdx = (activeExIndex + 1) % examplesList.length;
          return { ...prev, [currentItem.user_word_sense_id]: nextIdx };
        });
      }
    }

    const nextQueue = (() => {
      let q = shouldRetry ? insertRetryCard(queue, nextIndex, gradedItem) : [...queue];
      if (sessionMode === 'repeat' && dueItems.length > 0 && nextIndex >= q.length) {
        q = [...q, ...shufflePracticeQueue(dueItems)];
      }
      return q;
    })();
    setQueue(nextQueue);

    const nextItem = nextQueue[nextIndex];
    if (nextItem) {
      setCardMode(decideCardMode(nextItem));
    }

    setCurrentIndex(nextIndex);
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

  const handleEndSession = () => {
    if (sessionMode === 'repeat') {
      finishRepeatSession();
      return;
    }
    setChromeHidden(false);
    if (pendingRef.current.length > 0 || flushingRef.current) {
      waitForPendingFlushes().catch(() => {});
    }
    setStatus('idle');
    navigation.navigate('Learn');
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
    setPracticeState('grading');
  };

  useKeyboardShortcut(
    [' ', 'Spacebar', 'Enter', '1', '2', '3', '4'],
    (e) => {
      if (!isFlipped) {
        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
          e.preventDefault();
          if (cardMode === 'flashcard') {
            toggleFlip();
          } else if (userAnswer.trim().length > 0) {
            revealAnswer(false);
          } else {
            revealAnswer(true);
          }
        }
      } else if (e.key === '1') {
        e.preventDefault();
        selectGrade('again');
      } else if (e.key === '2') {
        e.preventDefault();
        selectGrade('hard');
      } else if (e.key === '3') {
        e.preventDefault();
        selectGrade('good');
      } else if (e.key === '4') {
        e.preventDefault();
        selectGrade('easy');
      }
    },
    { enabled: status === 'active' },
  );

  if (status === 'loading_due' || status === 'loading_repeat') {
    return (
      <Screen padded>
        <PageColumn>
          <LoadingState message={t('practice.preparing')} />
        </PageColumn>
      </Screen>
    );
  }

  if (status === 'submitting') {
    return (
      <Screen padded>
        <PageColumn>
          <LoadingState message={t('practice.syncing')} />
        </PageColumn>
      </Screen>
    );
  }

  if (status === 'success') {
    const stuckList = Object.values(sessionStuck);
    return (
      <Screen padded>
        <Confetti active={true} />
        <PageColumn style={[styles.center, { gap: spacing.lg }]}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.infoSurface }]}>
            <Icon name="checkmark-circle" size="xl" color={colors.accent} />
          </View>
          <Text variant="heading" style={{ textAlign: 'center' }}>
            {t('practice.complete')}
          </Text>
          <Card style={{ width: '100%', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" bold>
              {t('practice.xpEarned')}
            </Text>
            <Badge
              variant="accent"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text variant="caption" bold style={{ color: colors.accent }}>
                +
              </Text>
              <CountUpText
                target={xpEarned}
                variant="caption"
                bold
                style={{ color: colors.accent }}
              />
              <Text variant="caption" bold style={{ color: colors.accent }}>
                {' '}
                XP
              </Text>
            </Badge>
            <Text color="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              {t('practice.progressSaved')}
            </Text>
          </Card>
          {stuckList.length > 0 ? (
            <Card style={{ width: '100%', gap: spacing.sm }}>
              <Text variant="title" bold>
                {t('practice.stuckWords')}
              </Text>
              <Text variant="caption" color="muted">
                {t('practice.stuckWordsHelp')}
              </Text>
              {stuckList.map((stuck) => (
                <View
                  key={stuck.user_word_sense_id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                    flexWrap: 'wrap',
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}
                  >
                    <Text variant="body" bold>
                      {stuck.lemma}
                    </Text>
                    <Badge label={t('practice.leechBadge')} variant="danger" />
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <Button
                      label={t('practice.changeMeaning')}
                      variant="secondary"
                      onPress={() => openChangeMeaning(stuck, false)}
                    />
                    <Button
                      label={t('practice.writeMyMeaning')}
                      variant="quiet"
                      onPress={() => openChangeMeaning(stuck, true)}
                    />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          <Button
            label={t('practice.backHome')}
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('idle');
              setSessionStuck({});
              navigation.navigate('Learn');
            }}
          />
        </PageColumn>
        {changeMeaningItem ? (
          <ChangeMeaningSheet
            visible
            item={changeMeaningItem}
            preferPersonalNote={preferPersonalNote}
            onClose={() => setChangeMeaningItem(null)}
            onChanged={handleMeaningChanged}
          />
        ) : null}
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen padded>
        <PageColumn style={[styles.center, { gap: spacing.lg }]}>
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
            variant="quiet"
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('idle');
              navigation.navigate('Learn');
            }}
          />
        </PageColumn>
      </Screen>
    );
  }

  if (status === 'idle') {
    return (
      <Screen padded>
        <PageColumn style={[styles.center, { gap: spacing.lg }]}>
          <EmptyState
            icon="layers-outline"
            title={t('home.allCaughtUp')}
            message={t('practice.noDueCustom')}
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
            variant="secondary"
            iconLeft="play"
            style={{ width: '100%' }}
            onPress={startRepeatSession}
          />
        </PageColumn>
      </Screen>
    );
  }

  const rawCurrentItem = queue[currentIndex];
  if (!rawCurrentItem) {
    return (
      <Screen padded>
        <PageColumn>
          <LoadingState message={t('practice.syncing')} />
        </PageColumn>
      </Screen>
    );
  }

  const currentItem = resolveDueItem(rawCurrentItem, itemOverrides);

  const examplesList = currentItem.examples || [];
  const activeExIndex = exampleIndexMap[currentItem.user_word_sense_id] ?? 0;
  const example = examplesList.length > 0 ? examplesList[activeExIndex] : null;
  const isPreviouslyFailed = failedMap[currentItem.user_word_sense_id] ?? false;
  const trimmedAnswer = userAnswer.trim();

  const {
    current: displayCurrent,
    total: displayTotal,
    percent: progressPercent,
  } = sessionProgress({
    attempts,
    dueIds: dueItems.map((item) => item.user_word_sense_id),
  });

  const blankedSentence = example
    ? getBlankedSentence(example.sentence, currentItem.normalized_text)
    : '';

  const showAnswerBar = cardMode === 'typing' && !isFlipped;
  const showGradingBar = isFlipped;
  const gradingBarFallback = (sessionMode === 'repeat' ? 200 : 150) + insets.bottom;
  const answerBarFallback = 144 + insets.bottom;
  const answerBarHeight =
    measuredAnswerBarHeight > 0 ? measuredAnswerBarHeight : answerBarFallback;
  const gradingBarHeight =
    measuredGradingBarHeight > 0 ? measuredGradingBarHeight : gradingBarFallback;

  const progressHeaderApprox = 72;
  const swipeGuideApprox = 28;
  const cardMaxHeight = Math.max(
    240,
    windowHeight -
      insets.top -
      progressHeaderApprox -
      (showGradingBar ? gradingBarHeight : showAnswerBar ? answerBarHeight : 0) -
      (showGradingBar ? swipeGuideApprox : 0) -
      spacing.md * 2,
  );

  const handleGradingBarLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next > 0 && Math.abs(next - measuredGradingBarHeight) > 1) {
      setMeasuredGradingBarHeight(next);
    }
  };

  const handleAnswerBarLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next > 0 && Math.abs(next - measuredAnswerBarHeight) > 1) {
      setMeasuredAnswerBarHeight(next);
    }
  };

  const answerBar = showAnswerBar ? (
    <Card
      onLayout={handleAnswerBarLayout}
      style={[
        styles.bottomBar,
        {
          borderTopColor: colors.hairline,
          paddingBottom: spacing.lg + insets.bottom,
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
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => revealAnswer(false)}
        onFocus={() => {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }}
        style={[
          styles.answerInput,
          {
            borderColor: colors.controlBorder,
            backgroundColor: colors.surface,
            color: colors.text,
            borderRadius: radii.sm,
          },
        ]}
      />
      <View style={[styles.revealActions, { gap: spacing.sm }]}>
        <Button
          label={t('practice.checkAnswer')}
          disabled={trimmedAnswer.length === 0}
          style={styles.revealButton}
          onPress={() => revealAnswer(false)}
        />
        <Button
          label={t('practice.dontKnow')}
          variant="secondary"
          style={styles.revealButton}
          onPress={() => revealAnswer(true)}
        />
      </View>
    </Card>
  ) : null;

  const gradingSection = showGradingBar ? (
    <View
      onLayout={handleGradingBarLayout}
      style={[
        styles.gradingSection,
        {
          paddingBottom: insets.bottom,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="caption" color="muted" style={styles.srOnly}>
        {t('practice.rateRecall')}
      </Text>
      <RatingBar intervals={currentItem.preview_intervals} onSelect={selectGrade} />
      {sessionMode === 'repeat' && (
        <Button
          label={t('practice.finishRepeat')}
          variant="secondary"
          style={{ width: '100%' }}
          onPress={finishRepeatSession}
        />
      )}
    </View>
  ) : null;

  return (
    <Screen padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scroll,
            showAnswerBar && { paddingBottom: answerBarHeight + spacing.md },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <PageColumn style={{ gap: spacing.lg }}>
            <View style={[styles.progressHeader, { gap: 14 }]}>
              <View style={styles.progressTextRow}>
                <Button
                  label={t('practice.endSession')}
                  variant="quiet"
                  iconLeft="close"
                  testID="practice-end-session"
                  onPress={handleEndSession}
                />
                <View style={styles.saveIndicator}>
                  {isSaving && (
                    <>
                      <ActivityIndicator size="small" color={colors.textMuted} />
                      <Text variant="caption" color="muted">
                        {t('practice.syncing')}
                      </Text>
                    </>
                  )}
                  {!isSaving && saveError && (
                    <>
                      <Icon name="warning-outline" size="sm" color={colors.danger} />
                      <Text variant="caption" color="danger">
                        {t('practice.saveError')}
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.headerRight}>
                  {sessionMode === 'repeat' && (
                    <Badge label={t('practice.repeatMode')} variant="accent" />
                  )}
                  <Text
                    variant="caption"
                    color="muted"
                    tabular
                    testID="practice-position-counter"
                  >
                    {t('practice.position', { current: displayCurrent, total: displayTotal })}
                  </Text>
                </View>
              </View>
              <AnimatedProgressBar percent={progressPercent} height={3} />
            </View>

            <Animated.View
              style={{
                transform: [{ translateX: slideAnim }],
                opacity: opacityAnim,
                width: '100%',
                position: 'relative',
              }}
            >
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
                onRate={selectGrade}
                maxHeight={cardMaxHeight}
              />
            </Animated.View>

            {currentItem.is_leech && isFlipped ? (
              <Button
                label={t('practice.changeMeaning')}
                variant="quiet"
                style={{ alignSelf: 'center' }}
                onPress={() => openChangeMeaning(currentItem, false)}
              />
            ) : null}

            {gradingSection}

            {sessionMode === 'repeat' && !isFlipped && (
              <Button
                label={t('practice.finishRepeat')}
                variant="quiet"
                style={{ alignSelf: 'center', marginTop: spacing.sm }}
                onPress={finishRepeatSession}
              />
            )}
          </PageColumn>
        </ScrollView>

        {answerBar}
      </KeyboardAvoidingView>
      {changeMeaningItem ? (
        <ChangeMeaningSheet
          visible
          item={changeMeaningItem}
          preferPersonalNote={preferPersonalNote}
          onClose={() => setChangeMeaningItem(null)}
          onChanged={handleMeaningChanged}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingVertical: 16,
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
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
    zIndex: 1000,
    elevation: 24,
  },
  gradingSection: {
    width: '100%',
  },
  answerInput: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  revealActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revealButton: {
    flex: 1,
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 'auto',
    marginLeft: 8,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

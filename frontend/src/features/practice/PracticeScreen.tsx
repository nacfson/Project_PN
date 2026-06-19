import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, LoadingState, Screen, Text } from '../../ui';
import {
  getDueLearningItems,
  listLearningItems,
  recordBatchReviewAttempts,
} from '../../api/learningItems';
import type { DueItem, ReviewAttemptParams, Example } from '../../types';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Practice'>;
type SessionStatus =
  | 'idle'
  | 'loading_due'
  | 'loading_preview'
  | 'active'
  | 'submitting'
  | 'success'
  | 'error';

export function mapScoreToQuality(score: number): number {
  if (score < 1.0) {
    return score * 3.0;
  }
  return 3.0 + (score - 1.0) * 1.0;
}

interface FaceProps {
  stateVal: number;
  color: string;
}

function Face({ stateVal, color }: FaceProps) {
  return (
    <View style={faceStyles.faceContainer}>
      <View style={faceStyles.eyesRow}>
        <Eye stateVal={stateVal} color={color} />
        <Eye stateVal={stateVal} color={color} />
      </View>
      <Mouth stateVal={stateVal} color={color} />
    </View>
  );
}

function Eye({ stateVal, color }: { stateVal: number; color: string }) {
  if (stateVal === 0) {
    return (
      <View style={faceStyles.eyeXContainer}>
        <View style={[faceStyles.eyeXLine, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
        <View style={[faceStyles.eyeXLine, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
      </View>
    );
  }
  if (stateVal === 1) {
    return <View style={[faceStyles.eyeFlat, { backgroundColor: color }]} />;
  }
  const isExcited = stateVal === 3;
  return (
    <View
      style={[
        faceStyles.eyeArch,
        {
          borderColor: color,
          height: isExcited ? 6 : 4,
          borderTopWidth: isExcited ? 2.5 : 2,
        },
      ]}
    />
  );
}

function Mouth({ stateVal, color }: { stateVal: number; color: string }) {
  if (stateVal === 0) {
    return <View style={[faceStyles.mouthFrown, { borderColor: color }]} />;
  }
  if (stateVal === 1) {
    return <View style={[faceStyles.mouthFlat, { backgroundColor: color }]} />;
  }
  const isBig = stateVal === 3;
  return (
    <View
      style={[
        faceStyles.mouthSmile,
        {
          borderColor: color,
          height: isBig ? 10 : 6,
          width: isBig ? 18 : 14,
          borderBottomWidth: isBig ? 3.5 : 2.5,
          borderBottomLeftRadius: isBig ? 9 : 7,
          borderBottomRightRadius: isBig ? 9 : 7,
          marginTop: isBig ? 0 : 2,
        },
      ]}
    />
  );
}

interface SlidebarProps {
  ratingScore: number;
  onChange: (score: number) => void;
}

const handleWidth = 44;
const sliderColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
const sliderBgColors = [
  'rgba(239, 68, 68, 0.15)',
  'rgba(245, 158, 11, 0.15)',
  'rgba(16, 185, 129, 0.15)',
  'rgba(59, 130, 246, 0.15)',
];
const sliderLabelKeys = [
  'practice.ratingForgot',
  'practice.ratingHard',
  'practice.ratingGood',
  'practice.ratingEasy',
] as const;

function Slidebar({ ratingScore, onChange }: SlidebarProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const [trackWidth, setTrackWidth] = useState(0);
  const startRatingScore = useRef(ratingScore);
  const handleScale = useRef(new Animated.Value(1)).current;
  const lastStateVal = useRef(
    ratingScore < 0.75 ? 0 : ratingScore < 1.5 ? 1 : ratingScore < 2.25 ? 2 : 3
  );

  const stateVal =
    ratingScore < 0.75 ? 0 : ratingScore < 1.5 ? 1 : ratingScore < 2.25 ? 2 : 3;

  const color = sliderColors[stateVal];
  const label = t(sliderLabelKeys[stateVal]);
  const bgColor = sliderBgColors[stateVal];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRatingScore.current = ratingScore;
        Animated.spring(handleScale, {
          toValue: 1.2,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        const maxLeft = trackWidth - handleWidth;
        if (maxLeft <= 0) return;

        const startPercent = startRatingScore.current / 3.0;
        const startX = startPercent * maxLeft;
        let targetX = startX + gestureState.dx;

        if (targetX < 0) targetX = 0;
        if (targetX > maxLeft) targetX = maxLeft;

        const newPercent = targetX / maxLeft;
        const score = Math.max(0, Math.min(3.0, newPercent * 3.0));
        const newStateVal =
          score < 0.75 ? 0 : score < 1.5 ? 1 : score < 2.25 ? 2 : 3;
        if (newStateVal !== lastStateVal.current) {
          lastStateVal.current = newStateVal;
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync().catch(() => {});
          }
        }
        onChange(score);
      },
      onPanResponderRelease: () => {
        Animated.spring(handleScale, {
          toValue: 1.0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(handleScale, {
          toValue: 1.0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const maxLeft = trackWidth - handleWidth;
  const currentPercent = ratingScore / 3.0;
  const leftPos = maxLeft > 0 ? currentPercent * maxLeft : 0;

  return (
    <View style={sliderStyles.container}>
      <View
        style={sliderStyles.trackWrapper}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={[sliderStyles.track, { backgroundColor: colors.border }]} />
        <View
          style={[
            sliderStyles.fill,
            {
              width: `${currentPercent * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            sliderStyles.handle,
            {
              left: leftPos,
              borderColor: color,
              backgroundColor: bgColor,
              shadowColor: color,
              transform: [{ scale: handleScale }],
            },
          ]}
        >
          <Face stateVal={stateVal} color={color} />
        </Animated.View>
      </View>
      <Text style={[sliderStyles.label, { color }]}>{label}</Text>
    </View>
  );
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

export function PracticeScreen() {
  const { colors, spacing, radii, shadows } = useTheme();
  const { t } = useAppLanguage();
  const cardStartedAtRef = useRef(Date.now());
  const navigation = useNavigation<NavigationProp>();

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [ratingScore, setRatingScore] = useState(2.0);

  const [attempts, setAttempts] = useState<ReviewAttemptParams[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [exampleIndexMap, setExampleIndexMap] = useState<Record<string, number>>({});
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});

  const resetCardInteraction = useCallback(() => {
    cardStartedAtRef.current = Date.now();
    setIsFlipped(false);
    setUserAnswer('');
    setResponseTimeMs(null);
    setRatingScore(2.0);
  }, []);

  const loadDueItems = useCallback(() => {
    setStatus('loading_due');
    setErrorMsg(null);
    getDueLearningItems()
      .then((items) => {
        setDueItems(items);
        if (items.length > 0) {
          setQueue([...items]);
          setCurrentIndex(0);
          setAttempts([]);
          setFailedMap({});
          setExampleIndexMap({});
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
      if (status !== 'active' && status !== 'success' && status !== 'submitting') {
        loadDueItems();
      }
    }, [loadDueItems, status])
  );

  const startPreviewSession = () => {
    setStatus('loading_preview');
    setErrorMsg(null);
    listLearningItems({ limit: 15 })
      .then((res) => {
        if (res.items.length > 0) {
          const previewItems: DueItem[] = res.items.map((item) => ({
            user_word_sense_id: item.id,
            word_sense_id: item.word_sense_id,
            word_id: item.word_id,
            language_code: item.language_code,
            lemma: item.lemma,
            normalized_text: item.normalized_text,
            part_of_speech: item.part_of_speech,
            display_language_code: item.display_language_code,
            definition: item.definition,
            short_definition: item.short_definition,
            localized_definition: item.localized_definition,
            localized_short_definition: item.localized_short_definition,
            cefr_level: item.cefr_level,
            meaning_order: item.meaning_order,
            learning_stage: item.learning_stage,
            due_at: item.due_at,
            examples: [],
          }));
          setDueItems(previewItems);
          setQueue(previewItems);
          setCurrentIndex(0);
          setAttempts([]);
          setFailedMap({});
          setExampleIndexMap({});
          resetCardInteraction();
          setStatus('active');
        } else {
          setStatus('idle');
          setErrorMsg(t('practice.noWordsPreview'));
        }
      })
      .catch((err) => {
        console.error('Error starting preview session:', err);
        setErrorMsg(err.message || t('practice.previewFailed'));
        setStatus('idle');
      });
  };

  useEffect(() => {
    if (status === 'active' && queue.length > 0 && currentIndex === queue.length) {
      setStatus('submitting');
      recordBatchReviewAttempts(attempts)
        .then((res) => {
          setXpEarned(res.xp_earned);
          setStatus('success');
        })
        .catch((err) => {
          console.error('Error submitting batch reviews:', err);
          setErrorMsg(err.message || t('practice.submitFailed'));
          setStatus('error');
        });
    }
  }, [currentIndex, queue.length, status, attempts]);

  const confirmGrade = () => {
    const currentItem = queue[currentIndex];
    if (!currentItem) return;

    const examplesList = currentItem.examples || [];
    const activeExIndex = exampleIndexMap[currentItem.user_word_sense_id] ?? 0;
    const example = examplesList.length > 0 ? examplesList[activeExIndex] : null;
    const activityType: ReviewAttemptParams['activity_type'] = example ? 'cloze' : 'meaning_to_word';
    const prompt = example
      ? getBlankedSentence(example.sentence, currentItem.normalized_text)
      : 'Definition: ' + currentItem.definition;

    const attempt: ReviewAttemptParams = {
      user_word_sense_id: currentItem.user_word_sense_id,
      activity_type: activityType,
      prompt,
      user_answer: userAnswer.trim().length > 0 ? userAnswer.trim() : null,
      correct_answer: currentItem.normalized_text,
      is_correct: ratingScore >= 0.75,
      rating_score: ratingScore,
      response_time_ms: responseTimeMs ?? Date.now() - cardStartedAtRef.current,
      confidence_rating: null,
    };

    setAttempts((prev) => [...prev, attempt]);

    if (ratingScore < 0.75) {
      setFailedMap((prev) => ({ ...prev, [currentItem.user_word_sense_id]: true }));
      if (examplesList.length > 1) {
        setExampleIndexMap((prev) => {
          const nextIdx = (activeExIndex + 1) % examplesList.length;
          return { ...prev, [currentItem.user_word_sense_id]: nextIdx };
        });
      }
      setQueue((prev) => [...prev, currentItem]);
    }

    setCurrentIndex((prev) => prev + 1);
    resetCardInteraction();
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
  };

  if (status === 'loading_due' || status === 'loading_preview') {
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
        <View style={[styles.center, { gap: spacing.lg }]}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.successSurface }]}>
            <Icon name="checkmark-circle" size="xl" color={colors.success} />
          </View>
          <Text variant="heading" color="success" style={{ textAlign: 'center' }}>
            {t('practice.complete')}
          </Text>
          <Card elevated style={{ width: '100%', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" bold>
              {t('practice.xpEarned')}
            </Text>
            <Badge label={`+${xpEarned} XP`} variant="success" />
            <Text color="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              {t('practice.progressSaved')}
            </Text>
          </Card>
          <Button
            label={t('practice.backHome')}
            variant="primary"
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
            variant="primary"
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('submitting');
              recordBatchReviewAttempts(attempts)
                .then((res) => {
                  setXpEarned(res.xp_earned);
                  setStatus('success');
                })
                .catch((err) => {
                  console.error('Retry submission error:', err);
                  setErrorMsg(err.message || t('practice.submitFailed'));
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
            variant="primary"
            iconLeft="refresh"
            style={{ width: '100%' }}
            onPress={loadDueItems}
          />

          <Button
            label={t('practice.previewSession')}
            variant="secondary"
            iconLeft="play"
            style={{ width: '100%' }}
            onPress={startPreviewSession}
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

  const dueItemsReviewedCount = attempts.filter((att) =>
    dueItems.some((di) => di.user_word_sense_id === att.user_word_sense_id)
  ).length;
  const progressPercent =
    dueItems.length > 0
      ? Math.min(100, Math.floor((dueItemsReviewedCount / dueItems.length) * 100))
      : 0;

  const cardSurface = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  };

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.progressHeader, { gap: spacing.sm }]}>
          <View style={styles.progressTextRow}>
            <Text variant="caption" color="muted">
              {t('practice.cardProgress', { current: currentIndex + 1, total: queue.length })}
            </Text>
            {isPreviouslyFailed && <Badge label={t('practice.retrying')} variant="danger" />}
          </View>
          <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: colors.success,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.cardPressable}>
          <View style={styles.cardContainer}>
            {!isFlipped ? (
              <View style={[styles.flashcard, cardSurface]}>
                <View style={styles.cardContent}>
                  <Badge label={currentItem.part_of_speech.toUpperCase()} variant="primary" />
                  <Text variant="caption" color="muted" style={styles.promptLabel}>
                    {t('practice.recallPrompt')}
                  </Text>
                  <Text variant="title" bold style={styles.definitionText}>
                    {currentItem.definition}
                  </Text>
                  {example ? (
                    <Text variant="body" style={styles.clozeText}>
                      &ldquo;{getBlankedSentence(example.sentence, currentItem.normalized_text)}&rdquo;
                    </Text>
                  ) : (
                    <Text variant="body" color="muted" style={styles.clozePlaceholder}>
                      {t('practice.noExample')}
                    </Text>
                  )}

                  <View style={[styles.answerBlock, { gap: spacing.sm, marginTop: spacing.md }]}>
                    <Text variant="label" color="muted">
                      {t('practice.yourAnswer')}
                    </Text>
                    <TextInput
                      value={userAnswer}
                      onChangeText={setUserAnswer}
                      placeholder={t('practice.answerPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => revealAnswer(false)}
                      style={[
                        styles.answerInput,
                        {
                          borderColor: colors.primary,
                          backgroundColor: colors.surfaceAlt,
                          color: colors.text,
                        },
                      ]}
                    />
                    <View style={[styles.revealActions, { gap: spacing.sm }]}>
                      <Button
                        label={t('practice.revealAnswer')}
                        variant="primary"
                        iconRight="eye"
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
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.flashcard, cardSurface]}>
                <View style={styles.cardContent}>
                  <Badge label={currentItem.part_of_speech.toUpperCase()} variant="primary" />
                  <Text variant="heading" style={styles.wordText}>
                    {currentItem.lemma}
                  </Text>
                  <View style={[styles.answerResult, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Text variant="caption" color="muted">
                      {t('practice.yourAnswer')}
                    </Text>
                    <Text variant="body" style={styles.answerResultText}>
                      {trimmedAnswer.length > 0 ? trimmedAnswer : t('practice.noAnswerGiven')}
                    </Text>
                  </View>
                  <Text variant="body" color="muted" style={styles.backDefinitionText}>
                    {currentItem.definition}
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
              </View>
            )}
          </View>
        </View>

        {isFlipped && (
          <View style={[styles.gradingPanel, { gap: spacing.md, borderTopColor: colors.border }]}>
            <Text style={{ textAlign: 'center' }} bold>
              {t('practice.rateRecall')}
            </Text>
            <Slidebar ratingScore={ratingScore} onChange={setRatingScore} />
            <Button
              label={t('practice.confirmGrade')}
              variant="primary"
              iconRight="arrow-forward"
              style={{ width: '100%', marginTop: spacing.xs }}
              onPress={confirmGrade}
            />
          </View>
        )}
      </ScrollView>
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
  cardPressable: {
    width: '100%',
    minHeight: 280,
  },
  cardContainer: {
    flex: 1,
    position: 'relative',
    minHeight: 280,
  },
  flashcard: {
    flex: 1,
    minHeight: 280,
    justifyContent: 'center',
    padding: 24,
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
    color: '#475569',
  },
  clozePlaceholder: {
    fontStyle: 'italic',
    textAlign: 'center',
  },
  answerBlock: {
    width: '100%',
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
  wordText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  backDefinitionText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
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
  gradingPanel: {
    width: '100%',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});

const faceStyles = StyleSheet.create({
  faceContainer: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 22,
    marginBottom: 4,
  },
  eyeXContainer: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeXLine: {
    position: 'absolute',
    width: 8,
    height: 1.8,
    borderRadius: 0.9,
  },
  eyeFlat: {
    width: 8,
    height: 1.8,
    borderRadius: 0.9,
  },
  eyeArch: {
    width: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  mouthFrown: {
    width: 14,
    height: 6,
    borderTopWidth: 2.5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 3,
  },
  mouthFlat: {
    width: 10,
    height: 1.8,
    borderRadius: 0.9,
    marginTop: 4,
  },
  mouthSmile: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  trackWrapper: {
    width: '90%',
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 8,
    borderRadius: 4,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    height: 8,
    borderRadius: 4,
    left: 0,
  },
  handle: {
    position: 'absolute',
    width: handleWidth,
    height: handleWidth,
    borderRadius: handleWidth / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
});

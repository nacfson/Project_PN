import type { DueItem } from '../../types';
import {
  applyDueItemUpdatesToList,
  insertRetryCard,
  learningPreviewFromSteps,
  mergeDueItemUpdate,
  optimisticDueItemAfterAgain,
  practiceCardProgress,
  resolveDueItem,
  shufflePracticeQueue,
} from './practiceItemState';

const baseItem: DueItem = {
  user_word_sense_id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  language_code: 'en',
  lemma: 'test',
  normalized_text: 'test',
  part_of_speech: 'noun',
  pronunciation: null,
  display_language_code: 'ko',
  definition: 'def',
  short_definition: null,
  localized_definition: 'def',
  localized_short_definition: null,
  cefr_level: null,
  meaning_order: 1,
  learning_stage: 'recognized',
  due_at: '2026-06-29T00:00:00Z',
  examples: [],
  preview_intervals: {
    again: '10m',
    hard: '1.2d',
    good: '2.5d',
    easy: '4.8d',
  },
};

describe('practiceItemState', () => {
  it('builds minute-level previews for learning steps', () => {
    expect(learningPreviewFromSteps([1, 10])).toEqual({
      again: '1m',
      hard: '1m',
      good: '10m',
      easy: '10m',
    });
  });

  it('optimistically switches a failed card into learning previews', () => {
    const next = optimisticDueItemAfterAgain(baseItem, {
      user_id: 'u1',
      new_cards_per_day: 20,
      reviews_per_day: 200,
      learning_steps: [1, 10],
      relearning_steps: [10],
      leech_threshold: 8,
      leech_action: 'suspend',
      fuzz_enabled: true,
      desired_retention: 0.9,
      daily_goal_xp: 100,
      fsrs_weights: [],
      weights_optimized_at: null,
      weights_review_count: 0,
    });

    expect(next.learning_stage).toBe('learning');
    expect(next.preview_intervals).toEqual({
      again: '1m',
      hard: '1m',
      good: '10m',
      easy: '10m',
    });
  });

  it('merges server batch updates into queued items', () => {
    const updated = applyDueItemUpdatesToList([baseItem], [
      {
        user_word_sense_id: 'uws-1',
        learning_stage: 'learning',
        due_at: '2026-06-29T00:01:00Z',
        preview_intervals: {
          again: '1m',
          hard: '1m',
          good: '10m',
          easy: '10m',
        },
      },
    ]);

    expect(updated[0]?.learning_stage).toBe('learning');
    expect(updated[0]?.preview_intervals?.good).toBe('10m');
  });

  it('resolves display item from override map', () => {
    const merged = resolveDueItem(baseItem, {
      'uws-1': mergeDueItemUpdate(baseItem, {
        learning_stage: 'learning',
        preview_intervals: { again: '1m', hard: '1m', good: '10m', easy: '10m' },
      }),
    });

    expect(merged.preview_intervals?.again).toBe('1m');
  });
});

describe('practice queue order', () => {
  const card = (lemma: string, wordId = lemma): DueItem => ({
    ...baseItem,
    user_word_sense_id: `uws-${lemma}`,
    word_sense_id: `ws-${lemma}`,
    word_id: wordId,
    lemma,
    normalized_text: lemma,
  });

  it('shuffles origin/add order so first-pass quizzes are not sequence-memorized', () => {
    const origin = [card('first'), card('second'), card('third'), card('fourth')];
    const reversed = shufflePracticeQueue(origin, () => 0);
    expect(reversed.map((item) => item.lemma)).not.toEqual(['first', 'second', 'third', 'fourth']);
    expect(reversed.map((item) => item.lemma).sort()).toEqual(['first', 'fourth', 'second', 'third']);
  });

  it('keeps sibling senses from landing consecutively after a shuffle', () => {
    const items = [card('run-1', 'run'), card('run-2', 'run'), card('go-1', 'go'), card('go-2', 'go')];
    const got = shufflePracticeQueue(items, () => 0.999);
    for (let i = 1; i < got.length; i += 1) {
      expect(got[i - 1]?.word_id).not.toBe(got[i]?.word_id);
    }
  });

  it('mixes a failed card into upcoming cards instead of appending in origin order', () => {
    const queue = [card('a'), card('b'), card('c'), card('d')];
    const retry = { ...card('a'), user_word_sense_id: 'retry-a' };

    const mixed = insertRetryCard(queue, 1, retry, () => 0);
    expect(mixed.map((item) => item.user_word_sense_id)).toEqual([
      'uws-a',
      'uws-c',
      'uws-d',
      'retry-a',
      'uws-b',
    ]);
    expect(mixed[mixed.length - 1]?.user_word_sense_id).not.toBe('retry-a');
  });

  it('reports unique-card progress instead of origin slot numbers on retry', () => {
    expect(practiceCardProgress([], 'a', 10)).toEqual({ current: 1, total: 10 });
    expect(practiceCardProgress(['a', 'b'], 'c', 10)).toEqual({ current: 3, total: 10 });
    expect(practiceCardProgress(['a', 'b', 'a'], 'a', 10)).toEqual({ current: 2, total: 10 });
  });
});

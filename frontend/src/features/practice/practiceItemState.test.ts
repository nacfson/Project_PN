import type { DueItem } from '../../types';
import {
  PASSING_SCORE_THRESHOLD,
  applyDueItemUpdatesToList,
  insertRetryCard,
  isPassingScore,
  learningPreviewFromSteps,
  mergeDueItemUpdate,
  optimisticDueItemAfterAgain,
  resolveDueItem,
  sessionProgress,
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

  it('drops future suspended leech copies while preserving graded indexes', () => {
    const futureCopy = { ...baseItem };
    const other = { ...baseItem, user_word_sense_id: 'uws-2', lemma: 'other', normalized_text: 'other' };
    const updated = applyDueItemUpdatesToList(
      [baseItem, other, futureCopy],
      [
        {
          user_word_sense_id: 'uws-1',
          learning_stage: 'mastered',
          due_at: '2026-06-29T00:01:00Z',
          suspended: true,
        },
      ],
      { preserveIndexesBefore: 1 },
    );

    expect(updated.map((item) => item.user_word_sense_id)).toEqual(['uws-1', 'uws-2']);
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
});

describe('isPassingScore & sessionProgress (contract vectors 1–11)', () => {
  const DUE_16 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'];
  const C = (id: string) => ({ user_word_sense_id: id, is_correct: true });
  const F = (id: string) => ({ user_word_sense_id: id, is_correct: false });

  it('evaluates isPassingScore at threshold 0.75 (0 -> false; 1, 2, 3 -> true)', () => {
    expect(PASSING_SCORE_THRESHOLD).toBe(0.75);
    expect(isPassingScore(0)).toBe(false);
    expect(isPassingScore(1)).toBe(true);
    expect(isPassingScore(2)).toBe(true);
    expect(isPassingScore(3)).toBe(true);
  });

  it('Vector 1: Session start', () => {
    expect(sessionProgress({ dueIds: DUE_16, attempts: [] })).toEqual({
      completed: 0,
      current: 1,
      total: 16,
      percent: 0,
    });
  });

  it('Vector 2: Three correct first try', () => {
    expect(sessionProgress({ dueIds: DUE_16, attempts: [C('a'), C('b'), C('c')] })).toEqual({
      completed: 3,
      current: 4,
      total: 16,
      percent: 18,
    });
  });

  it('Vector 3: Forgot does not advance', () => {
    expect(
      sessionProgress({ dueIds: DUE_16, attempts: [C('a'), C('b'), C('c'), F('d')] }),
    ).toEqual({
      completed: 3,
      current: 4,
      total: 16,
      percent: 18,
    });
  });

  it('Vector 4: Fail then correct counts once', () => {
    expect(
      sessionProgress({
        dueIds: DUE_16,
        attempts: [C('a'), C('b'), C('c'), F('d'), C('e'), C('d')],
      }),
    ).toEqual({
      completed: 5,
      current: 6,
      total: 16,
      percent: 31,
    });
  });

  it('Vector 5: Repeated fails', () => {
    expect(sessionProgress({ dueIds: DUE_16, attempts: [F('a'), F('a'), F('a')] })).toEqual({
      completed: 0,
      current: 1,
      total: 16,
      percent: 0,
    });
  });

  it('Vector 6: Correct twice counts once (repeat mode)', () => {
    expect(sessionProgress({ dueIds: DUE_16, attempts: [C('a'), C('a')] })).toEqual({
      completed: 1,
      current: 2,
      total: 16,
      percent: 6,
    });
  });

  it('Vector 7: Attempts outside dueIds ignored', () => {
    expect(
      sessionProgress({ dueIds: ['a', 'b', 'c'], attempts: [C('a'), C('z')] }),
    ).toEqual({
      completed: 1,
      current: 2,
      total: 3,
      percent: 33,
    });
  });

  it('Vector 8 (SC-012): All correct reaches 100 with 4 failed cards retried', () => {
    const failedIds = new Set(['d', 'h', 'k', 'n']);
    const attempts: Array<{ user_word_sense_id: string; is_correct: boolean }> = [];
    let expectedCompleted = 0;

    for (const id of DUE_16) {
      if (failedIds.has(id)) {
        attempts.push(F(id));
        const afterFail = sessionProgress({ dueIds: DUE_16, attempts });
        expect(afterFail.completed).toBe(expectedCompleted);
      }
      attempts.push(C(id));
      expectedCompleted += 1;
      const afterCorrect = sessionProgress({ dueIds: DUE_16, attempts });
      expect(afterCorrect.completed).toBe(expectedCompleted);
    }

    expect(sessionProgress({ dueIds: DUE_16, attempts })).toEqual({
      completed: 16,
      current: 16,
      total: 16,
      percent: 100,
    });
  });

  it('Vector 9: Not 100 while a failure is pending', () => {
    const attempts = [...DUE_16.slice(0, 15).map(C), F('p')];
    expect(sessionProgress({ dueIds: DUE_16, attempts })).toEqual({
      completed: 15,
      current: 16,
      total: 16,
      percent: 93,
    });
  });

  it('Vector 10: Empty session', () => {
    expect(sessionProgress({ dueIds: [], attempts: [] })).toEqual({
      completed: 0,
      current: 1,
      total: 1,
      percent: 0,
    });
  });

  it('Vector 11: Duplicate dueIds', () => {
    expect(sessionProgress({ dueIds: ['a', 'a', 'b'], attempts: [C('a')] })).toEqual({
      completed: 1,
      current: 2,
      total: 2,
      percent: 50,
    });
  });
});

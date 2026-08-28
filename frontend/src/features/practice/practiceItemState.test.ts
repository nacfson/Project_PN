import type { DueItem } from '../../types';
import {
  applyDueItemUpdatesToList,
  learningPreviewFromSteps,
  mergeDueItemUpdate,
  optimisticDueItemAfterAgain,
  resolveDueItem,
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

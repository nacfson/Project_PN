import type {
  BatchReviewItemUpdate,
  DueItem,
  IntervalPreview,
  ReviewAttemptParams,
  ReviewSettings,
} from '../../types';

export const PASSING_SCORE_THRESHOLD = 0.75;

/** Single source of truth for "correct" (FR-015c). */
export function isPassingScore(score: number): boolean {
  return score >= PASSING_SCORE_THRESHOLD;
}

export interface SessionProgressInput {
  /** Attempts recorded this session, in order. Existing ReviewAttemptParams shape. */
  attempts: ReadonlyArray<Pick<ReviewAttemptParams, 'user_word_sense_id' | 'is_correct'>>;
  /** user_word_sense_id of every due item loaded at session start. Fixed for the session. */
  dueIds: ReadonlyArray<string>;
}

export interface SessionProgress {
  completed: number; // distinct dueIds with ≥1 attempt where is_correct === true
  total: number; // max(distinct dueIds count, 1)
  current: number; // min(completed + 1, total)
  percent: number; // floor(completed / total * 100), 0–100
}

export function sessionProgress(input: SessionProgressInput): SessionProgress {
  const distinctDueIds = new Set(input.dueIds);
  const total = Math.max(distinctDueIds.size, 1);
  const completedIds = new Set<string>();
  for (const att of input.attempts) {
    if (att.is_correct && distinctDueIds.has(att.user_word_sense_id)) {
      completedIds.add(att.user_word_sense_id);
    }
  }
  const completed = completedIds.size;
  const current = Math.min(completed + 1, total);
  const percent = Math.floor((completed / total) * 100);
  return {
    completed,
    total,
    current,
    percent,
  };
}

export function formatStepMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m`;
  }
  const hours = Math.round(minutes / 60);
  return `${Math.max(1, hours)}h`;
}

export function learningPreviewFromSteps(steps: number[]): IntervalPreview {
  const first = steps[0] ?? 1;
  const second = steps[1] ?? first;
  const last = steps[steps.length - 1] ?? second;
  return {
    again: formatStepMinutes(first),
    hard: formatStepMinutes(first),
    good: formatStepMinutes(second),
    easy: formatStepMinutes(last),
  };
}

/** Immediate client-side snapshot after "Again" until the server batch sync returns. */
export function optimisticDueItemAfterAgain(item: DueItem, settings?: ReviewSettings | null): DueItem {
  const steps = settings?.learning_steps?.length ? settings.learning_steps : [1, 10];
  return {
    ...item,
    learning_stage: 'learning',
    preview_intervals: learningPreviewFromSteps(steps),
  };
}

export function mergeDueItemUpdate(item: DueItem, update: Partial<DueItem>): DueItem {
  return {
    ...item,
    ...update,
    preview_intervals: update.preview_intervals ?? item.preview_intervals,
  };
}

export function applyDueItemUpdatesToList(
  items: DueItem[],
  updates: BatchReviewItemUpdate[],
  options?: { preserveIndexesBefore?: number },
): DueItem[] {
  if (updates.length === 0) {
    return items;
  }
  const byId = new Map(updates.map((update) => [update.user_word_sense_id, update]));
  const suspendedIds = new Set(
    updates.filter((update) => update.suspended).map((update) => update.user_word_sense_id),
  );
  const preserveBefore = options?.preserveIndexesBefore ?? 0;

  return items
    .filter((item, idx) => {
      if (!suspendedIds.has(item.user_word_sense_id)) {
        return true;
      }
      // Keep already-graded slots so currentIndex stays valid; drop future copies.
      return idx < preserveBefore;
    })
    .map((item) => {
      const update = byId.get(item.user_word_sense_id);
      if (!update || update.suspended) {
        return item;
      }
      return mergeDueItemUpdate(item, {
        learning_stage: update.learning_stage,
        due_at: update.due_at,
        preview_intervals: update.preview_intervals,
        is_leech: Boolean(update.is_leech || update.leech || item.is_leech),
        lapse_count: update.lapse_count ?? item.lapse_count,
      });
    });
}

export function overridesFromBatchUpdates(
  updates: BatchReviewItemUpdate[],
): Record<string, Partial<DueItem>> {
  const next: Record<string, Partial<DueItem>> = {};
  for (const update of updates) {
    if (update.suspended) {
      continue;
    }
    next[update.user_word_sense_id] = {
      learning_stage: update.learning_stage,
      due_at: update.due_at,
      preview_intervals: update.preview_intervals,
      is_leech: Boolean(update.is_leech || update.leech),
      lapse_count: update.lapse_count,
    };
  }
  return next;
}

export function resolveDueItem(
  item: DueItem,
  overrides: Record<string, Partial<DueItem>>,
): DueItem {
  const override = overrides[item.user_word_sense_id];
  if (!override) {
    return item;
  }
  return mergeDueItemUpdate(item, override);
}

type WordIdItem = { word_id: string };

export function shufflePracticeQueue<T extends WordIdItem>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  return interleaveByWordId(fisherYates(items, random));
}

/** Requeue a failed card among upcoming cards instead of appending in fail/origin order. */
export function insertRetryCard<T>(
  queue: readonly T[],
  fromIndex: number,
  item: T,
  random: () => number = Math.random,
): T[] {
  const start = Math.min(Math.max(fromIndex, 0), queue.length);
  const head = queue.slice(0, start);
  const tail = queue.slice(start);
  const mixed = fisherYates([...tail, item], random);
  const minGap = Math.min(2, tail.length);
  const retryPos = mixed.indexOf(item);
  if (retryPos >= 0 && retryPos < minGap && mixed.length > minGap) {
    const swapAt = minGap + Math.floor(random() * (mixed.length - minGap));
    const current = mixed[retryPos];
    const later = mixed[swapAt];
    if (current !== undefined && later !== undefined) {
      mixed[retryPos] = later;
      mixed[swapAt] = current;
    }
  }
  return [...head, ...mixed];
}

function fisherYates<T>(items: readonly T[], random: () => number): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    next[i] = b;
    next[j] = a;
  }
  return next;
}

function interleaveByWordId<T extends WordIdItem>(items: T[]): T[] {
  if (items.length <= 1) {
    return items;
  }

  const bucketIndex = new Map<string, number>();
  const buckets: T[][] = [];
  for (const item of items) {
    let idx = bucketIndex.get(item.word_id);
    if (idx === undefined) {
      idx = buckets.length;
      bucketIndex.set(item.word_id, idx);
      buckets.push([]);
    }
    buckets[idx]?.push(item);
  }

  const result: T[] = [];
  while (result.length < items.length) {
    let progress = false;
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (!next) {
        continue;
      }
      result.push(next);
      progress = true;
    }
    if (!progress) {
      break;
    }
  }
  return result;
}

import type { BatchReviewItemUpdate, DueItem, IntervalPreview, ReviewSettings } from '../../types';

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

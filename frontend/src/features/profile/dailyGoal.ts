export const GOAL_PRESETS = [100, 200, 300, 500] as const;

export interface GoalOption {
  value: number;
  custom: boolean;
}

export function goalOptions(saved: number | null | undefined): GoalOption[] {
  const base: GoalOption[] = GOAL_PRESETS.map((value) => ({
    value,
    custom: false,
  }));

  if (
    typeof saved === 'number' &&
    Number.isFinite(saved) &&
    saved > 0 &&
    !GOAL_PRESETS.includes(saved as (typeof GOAL_PRESETS)[number])
  ) {
    base.push({ value: saved, custom: true });
    base.sort((a, b) => a.value - b.value);
  }

  return base;
}

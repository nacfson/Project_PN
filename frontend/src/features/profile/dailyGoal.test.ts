import { GOAL_PRESETS, goalOptions } from './dailyGoal';

describe('goalOptions', () => {
  it('returns the 4 standard presets when saved is 200', () => {
    expect(goalOptions(200)).toEqual([
      { value: 100, custom: false },
      { value: 200, custom: false },
      { value: 300, custom: false },
      { value: 500, custom: false },
    ]);
    expect(GOAL_PRESETS).toEqual([100, 200, 300, 500]);
  });

  it('inserts a non-preset saved value in ascending order and marks it custom', () => {
    expect(goalOptions(250)).toEqual([
      { value: 100, custom: false },
      { value: 200, custom: false },
      { value: 250, custom: true },
      { value: 300, custom: false },
      { value: 500, custom: false },
    ]);
  });

  it('adds nothing when saved is 500', () => {
    expect(goalOptions(500)).toEqual([
      { value: 100, custom: false },
      { value: 200, custom: false },
      { value: 300, custom: false },
      { value: 500, custom: false },
    ]);
  });
});

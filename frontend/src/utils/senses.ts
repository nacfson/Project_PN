import type { SenseOption } from '../types';

export function bestMatch(options: SenseOption[]): SenseOption | null {
  if (options.length === 0) {
    return null;
  }
  return options.reduce((best, current) =>
    current.meaning_order < best.meaning_order ? current : best,
  );
}

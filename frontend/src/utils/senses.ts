import type { SenseOption } from '../types';

/** Minimum Jaccard to badge a sense as closest to the source sentence. */
export const CLOSEST_SIMILARITY_THRESHOLD = 0.15;

function similarityOf(option: SenseOption): number | null {
  return typeof option.similarity === 'number' ? option.similarity : null;
}

export function bestMatch(options: SenseOption[]): SenseOption | null {
  if (options.length === 0) {
    return null;
  }
  const scored = options.filter((option) => similarityOf(option) !== null);
  if (scored.length > 0) {
    return scored.reduce((best, current) =>
      (similarityOf(current) ?? 0) > (similarityOf(best) ?? 0) ? current : best,
    );
  }
  return options.reduce((best, current) =>
    current.meaning_order < best.meaning_order ? current : best,
  );
}

export function isClosestToContext(option: SenseOption, options: SenseOption[]): boolean {
  const top = bestMatch(options);
  const score = similarityOf(option);
  return (
    top?.word_sense_id === option.word_sense_id &&
    score !== null &&
    score >= CLOSEST_SIMILARITY_THRESHOLD
  );
}

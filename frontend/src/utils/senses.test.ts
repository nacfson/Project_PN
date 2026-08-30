import { bestMatch, isClosestToContext } from './senses';
import type { SenseOption } from '../types';

function option(partial: Partial<SenseOption> & Pick<SenseOption, 'word_sense_id' | 'meaning_order'>): SenseOption {
  return {
    word_id: 'w1',
    language_code: 'en',
    lemma: 'charge',
    normalized_text: 'charge',
    part_of_speech: 'verb',
    pronunciation: null,
    display_language_code: 'ko',
    definition: 'def',
    short_definition: null,
    localized_definition: 'gloss',
    localized_short_definition: null,
    cefr_level: null,
    examples: [],
    ...partial,
  };
}

describe('bestMatch', () => {
  it('picks the highest similarity when scores are present', () => {
    const options = [
      option({ word_sense_id: 'accuse', meaning_order: 1, similarity: 0.05 }),
      option({ word_sense_id: 'battery', meaning_order: 2, similarity: 0.4 }),
    ];
    expect(bestMatch(options)?.word_sense_id).toBe('battery');
  });

  it('falls back to lowest meaning_order without similarity', () => {
    const options = [
      option({ word_sense_id: 'second', meaning_order: 2 }),
      option({ word_sense_id: 'first', meaning_order: 1 }),
    ];
    expect(bestMatch(options)?.word_sense_id).toBe('first');
  });
});

describe('isClosestToContext', () => {
  it('badges only the top sense at or above the threshold', () => {
    const options = [
      option({ word_sense_id: 'accuse', meaning_order: 1, similarity: 0.05 }),
      option({ word_sense_id: 'battery', meaning_order: 2, similarity: 0.4 }),
    ];
    expect(isClosestToContext(options[1]!, options)).toBe(true);
    expect(isClosestToContext(options[0]!, options)).toBe(false);
  });

  it('does not badge when the best score is below the threshold', () => {
    const options = [option({ word_sense_id: 'a', meaning_order: 1, similarity: 0.05 })];
    expect(isClosestToContext(options[0]!, options)).toBe(false);
  });
});

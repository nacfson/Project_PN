import { decideCardMode } from './PracticeScreen';
import type { DueItem } from '../../types';

const baseItem: DueItem = {
  user_word_sense_id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  language_code: 'en',
  lemma: 'discipline',
  normalized_text: 'discipline',
  part_of_speech: 'noun',
  pronunciation: null,
  display_language_code: 'ko',
  definition: 'Training that develops self-control.',
  short_definition: null,
  localized_definition: '자제력을 기르는 훈련.',
  localized_short_definition: null,
  cefr_level: null,
  meaning_order: 1,
  learning_stage: 'new',
  due_at: '2026-06-29T00:00:00Z',
  examples: [],
};

function itemWithStage(stage: string): DueItem {
  return { ...baseItem, learning_stage: stage };
}

describe('decideCardMode', () => {
  const randomSpy = jest.spyOn(Math, 'random');

  afterEach(() => {
    randomSpy.mockReset();
  });

  afterAll(() => {
    randomSpy.mockRestore();
  });

  it('always uses typing for new and learning stages', () => {
    randomSpy.mockReturnValue(0);

    expect(decideCardMode(itemWithStage('new'))).toBe('typing');
    expect(decideCardMode(itemWithStage('learning'))).toBe('typing');
  });

  it('uses stage-weighted flashcard probabilities', () => {
    randomSpy.mockReturnValue(0.49);
    expect(decideCardMode(itemWithStage('recognized'))).toBe('flashcard');

    randomSpy.mockReturnValue(0.5);
    expect(decideCardMode(itemWithStage('recognized'))).toBe('typing');

    randomSpy.mockReturnValue(0.69);
    expect(decideCardMode(itemWithStage('recalled'))).toBe('flashcard');

    randomSpy.mockReturnValue(0.84);
    expect(decideCardMode(itemWithStage('usable'))).toBe('flashcard');

    randomSpy.mockReturnValue(0.94);
    expect(decideCardMode(itemWithStage('mastered'))).toBe('flashcard');
  });
});

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
  it('always uses flashcard for all stages (input quiz / typing mode deprecated)', () => {
    const stages = ['new', 'learning', 'recognized', 'recalled', 'usable', 'mastered'];
    for (const stage of stages) {
      expect(decideCardMode(itemWithStage(stage))).toBe('flashcard');
    }
  });
});

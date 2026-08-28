import type { Deck, LearningItemListItem } from '../../types';
import { adjustDeckCountsForMove, adjustDeckCountsForRemovedItems } from './deckCounts';

const baseDeck = (id: string, item_count: number): Deck => ({
  id,
  name: id,
  target_language: 'en',
  is_default: id === 'd1',
  item_count,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
});

const baseItem = (id: string, deck_id: string | null): LearningItemListItem => ({
  id,
  word_sense_id: `ws-${id}`,
  word_id: `w-${id}`,
  language_code: 'en',
  lemma: id,
  pronunciation: null,
  part_of_speech: 'verb',
  definition: 'def',
  short_definition: 'def',
  localized_definition: 'def',
  localized_short_definition: 'def',
  cefr_level: null,
  meaning_order: 1,
  learning_stage: 'learning',
  due_at: '2026-06-28T00:00:00Z',
  added_at: '2026-06-20T00:00:00Z',
  deck_id,
  deck_name: deck_id ? 'Deck' : null,
  last_reviewed_at: null,
  examples: [],
});

describe('deckCounts', () => {
  it('decrements source deck counts when items are removed', () => {
    const decks = [baseDeck('d1', 5), baseDeck('d2', 3)];
    const removed = [baseItem('a', 'd1'), baseItem('b', 'd1'), baseItem('c', 'd2')];

    const next = adjustDeckCountsForRemovedItems(decks, removed);

    expect(next.find((d) => d.id === 'd1')?.item_count).toBe(3);
    expect(next.find((d) => d.id === 'd2')?.item_count).toBe(2);
  });

  it('ignores items without a deck when adjusting remove counts', () => {
    const decks = [baseDeck('d1', 2)];
    const removed = [baseItem('a', null)];

    const next = adjustDeckCountsForRemovedItems(decks, removed);

    expect(next).toEqual(decks);
  });

  it('moves counts between decks when items change deck', () => {
    const decks = [baseDeck('d1', 4), baseDeck('d2', 2)];
    const moved = [baseItem('a', 'd1'), baseItem('b', 'd1')];

    const next = adjustDeckCountsForMove(decks, moved, 'd2');

    expect(next.find((d) => d.id === 'd1')?.item_count).toBe(2);
    expect(next.find((d) => d.id === 'd2')?.item_count).toBe(4);
  });

  it('does not decrement source when item is already in target deck', () => {
    const decks = [baseDeck('d1', 3)];
    const moved = [baseItem('a', 'd1')];

    const next = adjustDeckCountsForMove(decks, moved, 'd1');

    expect(next).toEqual(decks);
  });
});

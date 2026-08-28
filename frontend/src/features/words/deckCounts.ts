import type { Deck, LearningItemListItem } from '../../types';

export function adjustDeckCountsForRemovedItems(decks: Deck[], removedItems: LearningItemListItem[]): Deck[] {
  if (removedItems.length === 0) {
    return decks;
  }

  const countsByDeck = new Map<string, number>();
  for (const item of removedItems) {
    if (!item.deck_id) {
      continue;
    }
    countsByDeck.set(item.deck_id, (countsByDeck.get(item.deck_id) ?? 0) + 1);
  }

  if (countsByDeck.size === 0) {
    return decks;
  }

  return decks.map((deck) => {
    const removed = countsByDeck.get(deck.id);
    if (!removed) {
      return deck;
    }
    return {
      ...deck,
      item_count: Math.max(0, deck.item_count - removed),
    };
  });
}

export function adjustDeckCountsForMove(
  decks: Deck[],
  movedItems: LearningItemListItem[],
  targetDeckId: string,
): Deck[] {
  if (movedItems.length === 0) {
    return decks;
  }

  const sourceCounts = new Map<string, number>();
  for (const item of movedItems) {
    if (!item.deck_id || item.deck_id === targetDeckId) {
      continue;
    }
    sourceCounts.set(item.deck_id, (sourceCounts.get(item.deck_id) ?? 0) + 1);
  }

  const movedCount = movedItems.filter((item) => item.deck_id !== targetDeckId).length;
  if (sourceCounts.size === 0 && movedCount === 0) {
    return decks;
  }

  return decks.map((deck) => {
    if (deck.id === targetDeckId) {
      return {
        ...deck,
        item_count: deck.item_count + movedCount,
      };
    }
    const removed = sourceCounts.get(deck.id);
    if (!removed) {
      return deck;
    }
    return {
      ...deck,
      item_count: Math.max(0, deck.item_count - removed),
    };
  });
}

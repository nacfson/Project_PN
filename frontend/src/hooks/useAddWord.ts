import { useCallback, useState } from 'react';
import { lookupWord, addLearningItem } from '../api/words';

interface UseAddWordOptions {
  languageCode?: string;
  displayLanguageCode?: string;
}

interface AddedResult {
  word: string;
  deckId: string;
}

export function useAddWord(options: UseAddWordOptions = {}) {
  const [isAdding, setIsAdding] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddedResult | null>(null);

  const addWord = useCallback(
    async (word: string, deckId: string) => {
      const trimmed = word.trim();
      if (trimmed.length === 0 || !deckId) {
        return;
      }

      setIsAdding(true);
      setLastAdded(null);

      try {
        const response = await lookupWord(trimmed, {
          languageCode: options.languageCode,
          displayLanguageCode: options.displayLanguageCode,
        });
        const firstSense = response.sense_options[0];
        if (!firstSense) {
          return;
        }

        await addLearningItem(firstSense.word_sense_id, options.displayLanguageCode, deckId);
        setLastAdded({ word: trimmed, deckId });
      } catch {
        // Silent failure per design.
      } finally {
        setIsAdding(false);
      }
    },
    [options.languageCode, options.displayLanguageCode],
  );

  return { addWord, isAdding, lastAdded };
}

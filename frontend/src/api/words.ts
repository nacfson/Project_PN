import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import type { LearningItem, LookupResponse } from '../types';
import { postJson } from './client';

interface LookupOptions {
  partOfSpeech?: string;
  wordId?: string;
  force?: boolean;
  languageCode?: string;
  displayLanguageCode?: string;
}

export async function lookupWord(text: string, options: LookupOptions = {}): Promise<LookupResponse> {
  const partOfSpeech =
    options.partOfSpeech && options.partOfSpeech !== 'Any' ? options.partOfSpeech : undefined;

  return postJson<LookupResponse>('/api/words/lookup', {
    text,
    language_code: options.languageCode ?? DEFAULT_LANGUAGE_CODE,
    display_language_code: options.displayLanguageCode ?? DEFAULT_DEFINITION_LANGUAGE_CODE,
    part_of_speech: partOfSpeech,
    word_id: options.wordId,
    force: options.force ?? false,
  });
}

export async function addLearningItem(
  wordSenseId: string,
  displayLanguageCode: string = DEFAULT_DEFINITION_LANGUAGE_CODE,
  deckId?: string,
): Promise<LearningItem> {
  const body: Record<string, unknown> = {
    word_sense_id: wordSenseId,
    display_language_code: displayLanguageCode,
  };
  if (deckId) {
    body.deck_id = deckId;
  }
  return postJson<LearningItem>('/api/learning-items', body);
}

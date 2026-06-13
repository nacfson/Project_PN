import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import type { LearningItem, LookupResponse } from '../types';
import { postJson } from './client';

interface LookupOptions {
  partOfSpeech?: string;
  wordId?: string;
  force?: boolean;
  languageCode?: string;
  definitionLanguageCode?: string;
}

// lookupWord resolves a word to its concrete sense options. "Any" (or omitted)
// part of speech returns options across all parts of speech. force=true must
// include either a concrete part_of_speech or a wordId (enforced by the
// backend and guarded here).
export async function lookupWord(text: string, options: LookupOptions = {}): Promise<LookupResponse> {
  const partOfSpeech =
    options.partOfSpeech && options.partOfSpeech !== 'Any' ? options.partOfSpeech : undefined;

  return postJson<LookupResponse>('/api/words/lookup', {
    text,
    language_code: options.languageCode ?? DEFAULT_LANGUAGE_CODE,
    definition_language_code: options.definitionLanguageCode ?? DEFAULT_DEFINITION_LANGUAGE_CODE,
    part_of_speech: partOfSpeech,
    word_id: options.wordId,
    force: options.force ?? false,
  });
}

// addLearningItem creates the personal learnable item. It must be called with
// a concrete word_sense_id; never raw text or a bare word_id.
export async function addLearningItem(wordSenseId: string): Promise<LearningItem> {
  return postJson<LearningItem>('/api/learning-items', { word_sense_id: wordSenseId });
}

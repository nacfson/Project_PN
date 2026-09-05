import { patchJson, postJson } from './client';
import type { LearningItem, LookupRequest, LookupResponse, PosFilter } from './types';

export interface LookupOptions {
  partOfSpeech?: PosFilter;
  wordId?: string;
  force?: boolean;
  languageCode: string;
  displayLanguageCode: string;
  sourceContext?: string;
  traceId?: string;
}

export function lookupWord(text: string, options: LookupOptions): Promise<LookupResponse> {
  const body: LookupRequest = { text };
  if (options.partOfSpeech && options.partOfSpeech !== 'Any') {
    body.part_of_speech = options.partOfSpeech;
  }
  body.language_code = options.languageCode;
  body.display_language_code = options.displayLanguageCode;
  if (options.wordId) body.word_id = options.wordId;
  if (options.force) body.force = options.force;
  if (options.sourceContext) body.source_context = options.sourceContext;
  return postJson<LookupResponse>('/api/words/lookup', body, { traceId: options.traceId });
}

export function addLearningItem(
  wordSenseId: string,
  displayLanguageCode: string,
  deckId?: string,
  sourceContext?: string,
  traceId?: string,
): Promise<LearningItem> {
  const body: Record<string, unknown> = {
    word_sense_id: wordSenseId,
    display_language_code: displayLanguageCode,
  };
  if (deckId) {
    body.deck_id = deckId;
  }
  if (sourceContext) {
    body.source_context = sourceContext;
  }
  return postJson<LearningItem>('/api/learning-items', body, { traceId });
}

export function changeLearningItemSense(
  itemId: string,
  wordSenseId: string,
  displayLanguageCode?: string,
  traceId?: string,
): Promise<LearningItem> {
  const body: Record<string, unknown> = {
    word_sense_id: wordSenseId,
  };
  if (displayLanguageCode) {
    body.display_language_code = displayLanguageCode;
  }
  return patchJson<LearningItem>(`/api/learning-items/${itemId}`, body, { traceId });
}

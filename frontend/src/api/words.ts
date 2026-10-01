import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import {
  addLearningItem as addLearningItemApi,
  changeLearningItemSense as changeLearningItemSenseApi,
  setLearningItemPersonalNote as setLearningItemPersonalNoteApi,
  lookupWord as lookupWordApi,
} from './client';
import type { LearningItem, LookupResponse, PosFilter } from '@project-pn/api';
import { analytics } from '../analytics/analytics';

interface LookupOptions {
  partOfSpeech?: PosFilter;
  wordId?: string;
  force?: boolean;
  languageCode?: string;
  displayLanguageCode?: string;
  sourceContext?: string;
}

export async function lookupWord(text: string, options: LookupOptions = {}): Promise<LookupResponse> {
  const requested = options.force ? 'meaning_search_requested' : 'word_lookup_requested';
  const traceId = analytics.track(requested, { word: text, source_context: options.sourceContext ?? null, force: options.force === true });
  try {
    const result = await lookupWordApi(text, {
      partOfSpeech: options.partOfSpeech,
      wordId: options.wordId,
      force: options.force,
      languageCode: options.languageCode ?? DEFAULT_LANGUAGE_CODE,
      displayLanguageCode: options.displayLanguageCode ?? DEFAULT_DEFINITION_LANGUAGE_CODE,
      sourceContext: options.sourceContext,
      traceId,
    });
    analytics.track(options.force ? 'meaning_search_succeeded' : 'word_lookup_succeeded', { word: text, sense_count: result.sense_options.length, force: options.force === true }, traceId);
    return result;
  } catch (error) {
    analytics.track(options.force ? 'meaning_search_failed' : 'word_lookup_failed', {
      word: text, error_code: error instanceof Error && 'code' in error ? (error as { code?: string }).code ?? 'UNKNOWN' : 'UNKNOWN',
      retryable: error instanceof Error && 'retryable' in error ? (error as { retryable?: boolean }).retryable === true : false,
    }, traceId);
    throw error;
  }
}

export async function addLearningItem(
  wordSenseId: string,
  displayLanguageCode: string = DEFAULT_DEFINITION_LANGUAGE_CODE,
  deckId?: string,
  sourceContext?: string,
  personalNote?: string,
): Promise<LearningItem> {
  const traceId = analytics.track('word_add_requested', {
    word_sense_id: wordSenseId,
    deck_id: deckId ?? null,
    source_context: sourceContext ?? null,
    personal_note: personalNote ?? null,
  });
  try {
    const item = await addLearningItemApi(
      wordSenseId,
      displayLanguageCode,
      deckId,
      sourceContext,
      traceId,
      personalNote,
    );
    analytics.track('word_add_succeeded', { word_sense_id: wordSenseId, learning_item_id: item.id, deck_id: deckId ?? null }, traceId);
    return item;
  } catch (error) {
    analytics.track('word_add_failed', { word_sense_id: wordSenseId, error_code: error instanceof Error && 'code' in error ? (error as { code?: string }).code ?? 'UNKNOWN' : 'UNKNOWN', retryable: error instanceof Error && 'retryable' in error ? (error as { retryable?: boolean }).retryable === true : false }, traceId);
    throw error;
  }
}

export async function changeLearningItemSense(
  itemId: string,
  wordSenseId: string,
  displayLanguageCode: string = DEFAULT_DEFINITION_LANGUAGE_CODE,
  personalNote?: string | null,
): Promise<LearningItem> {
  const traceId = analytics.track('sense_selected', { learning_item_id: itemId, word_sense_id: wordSenseId });
  try {
    const item = await changeLearningItemSenseApi(
      itemId,
      wordSenseId,
      displayLanguageCode,
      traceId,
      personalNote,
    );
    analytics.track('sense_changed', { learning_item_id: itemId, word_sense_id: wordSenseId }, traceId);
    return item;
  } catch (error) {
    analytics.track('api_request_failed', { action: 'sense_change', learning_item_id: itemId, error_code: 'UNKNOWN', retryable: false }, traceId);
    throw error;
  }
}

export async function setLearningItemPersonalNote(itemId: string, personalNote: string): Promise<LearningItem> {
  return setLearningItemPersonalNoteApi(itemId, personalNote);
}

import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import {
  addLearningItem as addLearningItemApi,
  changeLearningItemSense as changeLearningItemSenseApi,
  lookupWord as lookupWordApi,
} from './client';
import type { LearningItem, LookupResponse, PosFilter } from '@project-pn/api';

interface LookupOptions {
  partOfSpeech?: PosFilter;
  wordId?: string;
  force?: boolean;
  languageCode?: string;
  displayLanguageCode?: string;
  sourceContext?: string;
}

export async function lookupWord(text: string, options: LookupOptions = {}): Promise<LookupResponse> {
  return lookupWordApi(text, {
    partOfSpeech: options.partOfSpeech,
    wordId: options.wordId,
    force: options.force,
    languageCode: options.languageCode ?? DEFAULT_LANGUAGE_CODE,
    displayLanguageCode: options.displayLanguageCode ?? DEFAULT_DEFINITION_LANGUAGE_CODE,
    sourceContext: options.sourceContext,
  });
}

export async function addLearningItem(
  wordSenseId: string,
  displayLanguageCode: string = DEFAULT_DEFINITION_LANGUAGE_CODE,
  deckId?: string,
  sourceContext?: string,
): Promise<LearningItem> {
  return addLearningItemApi(wordSenseId, displayLanguageCode, deckId, sourceContext);
}

export async function changeLearningItemSense(
  itemId: string,
  wordSenseId: string,
  displayLanguageCode: string = DEFAULT_DEFINITION_LANGUAGE_CODE,
): Promise<LearningItem> {
  return changeLearningItemSenseApi(itemId, wordSenseId, displayLanguageCode);
}

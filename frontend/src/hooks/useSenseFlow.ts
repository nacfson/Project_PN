import { useCallback, useRef, useState } from 'react';
import { addLearningItem, addManualLearningItem, lookupWord } from '../api/words';
import { ApiError } from '../api/client';
import { DEFAULT_DEFINITION_LANGUAGE_CODE } from '../config';
import { useAppLanguage } from '../i18n';
import type { PartOfSpeech, PosFilter, SenseOption } from '../types';
import { classifyAddError, type AddErrorInfo } from '../utils/addErrors';

interface SenseFlowCallbacks {
  onAdded?: (wordSenseId: string, queryText?: string) => void;
  onDismiss?: () => void;
}

function isNoAdditionalSensesError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'ADD-303';
}

export function useSenseFlow(callbacks: SenseFlowCallbacks = {}) {
  const { t } = useAppLanguage();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SenseOption[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<AddErrorInfo | null>(null);
  const [translationMissing, setTranslationMissing] = useState(false);
  const [suggestPosPrompt, setSuggestPosPrompt] = useState(false);

  const lastText = useRef('');
  const lastPos = useRef<PosFilter>('Any');
  const lastSourceContext = useRef('');
  const lastLanguageCode = useRef<string | undefined>(undefined);
  const lastDeckId = useRef<string | undefined>(undefined);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const confirmingRef = useRef(false);

  const applyError = useCallback(
    (err: unknown) => {
      const info = classifyAddError(err);
      setErrorInfo(info);
      setError(t(info.messageKey));
      return info;
    },
    [t],
  );

  const lookup = useCallback(
    async (
      text: string,
      posFilter: PosFilter,
      sourceContext?: string,
      languageCode?: string,
      deckId?: string,
    ): Promise<boolean> => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return false;
      }
      lastText.current = trimmed;
      lastPos.current = posFilter;
      lastSourceContext.current = (sourceContext ?? '').trim();
      lastLanguageCode.current = languageCode;
      lastDeckId.current = deckId;
      setQuery(trimmed);
      setError(null);
      setErrorInfo(null);
      setTranslationMissing(false);
      setSuggestPosPrompt(false);
      setLookingUp(true);
      setOptions([]);
      setPickerVisible(true);
      try {
        const response = await lookupWord(trimmed, {
          partOfSpeech: posFilter,
          sourceContext: lastSourceContext.current || undefined,
          languageCode,
        });
        setOptions(response.sense_options);
        if (response.sense_options.length === 0) {
          applyError(new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'));
          return false;
        }
        const missing =
          Boolean(response.translation_missing) ||
          (response.sense_options.some((o) => o.has_localized_translation === false) &&
            response.sense_options.every((o) => o.has_localized_translation === false));
        setTranslationMissing(missing);
        return true;
      } catch (err) {
        applyError(err);
        return false;
      } finally {
        setLookingUp(false);
      }
    },
    [applyError],
  );

  const openFailedLookup = useCallback(
    (
      text: string,
      posFilter: PosFilter,
      sourceContext: string | undefined,
      languageCode: string | undefined,
      deckId: string | undefined,
      existingError: AddErrorInfo,
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      lastText.current = trimmed;
      lastPos.current = posFilter;
      lastSourceContext.current = (sourceContext ?? '').trim();
      lastLanguageCode.current = languageCode;
      lastDeckId.current = deckId;
      setQuery(trimmed);
      setOptions([]);
      setLookingUp(false);
      setTranslationMissing(existingError.category === 'translation_missing');
      setSuggestPosPrompt(false);
      setErrorInfo(existingError);
      setError(t(existingError.messageKey));
      setPickerVisible(true);
    },
    [t],
  );

  const retry = useCallback(async (): Promise<boolean> => {
    if (!lastText.current) {
      return false;
    }
    return lookup(
      lastText.current,
      lastPos.current,
      lastSourceContext.current || undefined,
      lastLanguageCode.current,
      lastDeckId.current,
    );
  }, [lookup]);

  const rememberContext = (sourceContext?: string) => {
    const trimmed = (sourceContext ?? lastSourceContext.current).trim();
    if (sourceContext !== undefined) {
      lastSourceContext.current = trimmed;
    }
    return trimmed;
  };

  const forceExisting = useCallback(
    async (wordId: string, sourceContext?: string) => {
      setError(null);
      setErrorInfo(null);
      setSuggestPosPrompt(false);
      setLookingUp(true);
      try {
        const context = rememberContext(sourceContext);
        const response = await lookupWord(lastText.current, {
          wordId,
          force: true,
          sourceContext: context || undefined,
          languageCode: lastLanguageCode.current,
        });
        setOptions(response.sense_options);
        setTranslationMissing(Boolean(response.translation_missing));
      } catch (err) {
        applyError(err);
        if (isNoAdditionalSensesError(err)) {
          setSuggestPosPrompt(true);
        }
      } finally {
        setLookingUp(false);
      }
    },
    [applyError],
  );

  const forceWithPos = useCallback(
    async (pos: PartOfSpeech, sourceContext?: string) => {
      setError(null);
      setErrorInfo(null);
      setSuggestPosPrompt(false);
      setLookingUp(true);
      try {
        const context = rememberContext(sourceContext);
        const response = await lookupWord(lastText.current, {
          partOfSpeech: pos,
          force: true,
          sourceContext: context || undefined,
          languageCode: lastLanguageCode.current,
        });
        setOptions(response.sense_options);
        setTranslationMissing(Boolean(response.translation_missing));
      } catch (err) {
        applyError(err);
        if (isNoAdditionalSensesError(err)) {
          setSuggestPosPrompt(true);
        }
      } finally {
        setLookingUp(false);
      }
    },
    [applyError],
  );

  const confirm = useCallback(
    async (wordSenseId: string, deckId?: string, sourceContext?: string, personalNote?: string) => {
      if (confirmingRef.current) {
        return;
      }
      setError(null);
      setErrorInfo(null);
      confirmingRef.current = true;
      setConfirming(true);
      try {
        const resolvedDeck = deckId ?? lastDeckId.current;
        const resolvedContext = (sourceContext ?? lastSourceContext.current).trim();
        const resolvedNote = (personalNote ?? '').trim();
        await addLearningItem(
          wordSenseId,
          DEFAULT_DEFINITION_LANGUAGE_CODE,
          resolvedDeck,
          resolvedContext || undefined,
          resolvedNote || undefined,
        );
        setPickerVisible(false);
        callbacksRef.current.onAdded?.(wordSenseId, lastText.current);
      } catch (err) {
        applyError(err);
      } finally {
        confirmingRef.current = false;
        setConfirming(false);
      }
    },
    [applyError],
  );

  const addManual = useCallback(
    async (
      personalNote: string,
      partOfSpeech?: PartOfSpeech | 'unknown',
      deckId?: string,
      sourceContext?: string,
    ) => {
      if (confirmingRef.current) {
        return;
      }
      const trimmedNote = personalNote.trim();
      if (!trimmedNote) {
        applyError(new ApiError(400, 'personal meaning is required', 'ADD-310', false, 'personal_meaning_required'));
        return;
      }
      setError(null);
      setErrorInfo(null);
      confirmingRef.current = true;
      setConfirming(true);
      try {
        const resolvedDeck = deckId ?? lastDeckId.current;
        const resolvedContext = (sourceContext ?? lastSourceContext.current).trim();
        const resolvedPos =
          partOfSpeech ?? (lastPos.current !== 'Any' ? lastPos.current : undefined);
        const item = await addManualLearningItem({
          text: lastText.current,
          part_of_speech: resolvedPos,
          language_code: lastLanguageCode.current,
          display_language_code: DEFAULT_DEFINITION_LANGUAGE_CODE,
          deck_id: resolvedDeck,
          source_context: resolvedContext || undefined,
          personal_note: trimmedNote,
        });
        setPickerVisible(false);
        callbacksRef.current.onAdded?.(item.word_sense_id || item.id, lastText.current);
      } catch (err) {
        applyError(err);
      } finally {
        confirmingRef.current = false;
        setConfirming(false);
      }
    },
    [applyError],
  );

  const close = useCallback(() => {
    // Keep the picker open while confirming so loading cannot stick on the Find button.
    if (confirmingRef.current) {
      return;
    }
    setLookingUp(false);
    setPickerVisible(false);
    callbacksRef.current.onDismiss?.();
  }, []);

  return {
    pickerVisible,
    query,
    options,
    /** True while lookup / force-generate is in flight (SensePicker list spinner). */
    lookingUp,
    /** True while addLearningItem / addManualLearningItem is in flight (SensePicker Add button spinner). */
    confirming,
    /** Backward-compatible busy flag for callers that only need “any spinner”. */
    generating: lookingUp || confirming,
    error,
    errorInfo,
    translationMissing,
    suggestPosPrompt,
    lookup,
    openFailedLookup,
    retry,
    forceExisting,
    forceWithPos,
    confirm,
    addManual,
    close,
  };
}

export type { PartOfSpeech };

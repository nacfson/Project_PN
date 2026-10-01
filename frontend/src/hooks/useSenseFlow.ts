import { useCallback, useRef, useState } from 'react';
import { addLearningItem, lookupWord } from '../api/words';
import { ApiError } from '../api/client';
import { DEFAULT_DEFINITION_LANGUAGE_CODE } from '../config';
import { useAppLanguage } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { PartOfSpeech, PosFilter, SenseOption } from '../types';
import { classifyAddError } from '../utils/addErrors';

interface SenseFlowCallbacks {
  onAdded?: (wordSenseId: string) => void;
  onDismiss?: () => void;
}

function messageOf(
  error: unknown,
  t: (key: TranslationKey) => string,
): string {
  const info = classifyAddError(error);
  return `${info.code}: ${t(info.messageKey)}`;
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
  const [suggestPosPrompt, setSuggestPosPrompt] = useState(false);

  const lastText = useRef('');
  const lastPos = useRef<PosFilter>('Any');
  const lastSourceContext = useRef('');
  const lastLanguageCode = useRef<string | undefined>(undefined);
  const lastDeckId = useRef<string | undefined>(undefined);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const confirmingRef = useRef(false);

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
          setError(`ADD-303: ${t('add.error.noAdditionalSense')}`);
        }
        return true;
      } catch (err) {
        if (isNoAdditionalSensesError(err)) {
          setError(messageOf(err, t));
        } else {
          setError(messageOf(err, t));
        }
        return false;
      } finally {
        setLookingUp(false);
      }
    },
    [t],
  );

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
      } catch (err) {
        if (isNoAdditionalSensesError(err)) {
          setError(messageOf(err, t));
          setSuggestPosPrompt(true);
        } else {
          setError(messageOf(err, t));
        }
      } finally {
        setLookingUp(false);
      }
    },
    [t],
  );

  const forceWithPos = useCallback(
    async (pos: PartOfSpeech, sourceContext?: string) => {
      setError(null);
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
      } catch (err) {
        if (isNoAdditionalSensesError(err)) {
          setError(messageOf(err, t));
          setSuggestPosPrompt(true);
        } else {
          setError(messageOf(err, t));
        }
      } finally {
        setLookingUp(false);
      }
    },
    [t],
  );

  const confirm = useCallback(
    async (wordSenseId: string, deckId?: string, sourceContext?: string, personalNote?: string) => {
      if (confirmingRef.current) {
        return;
      }
      setError(null);
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
        callbacksRef.current.onAdded?.(wordSenseId);
      } catch (err) {
        setError(messageOf(err, t));
      } finally {
        confirmingRef.current = false;
        setConfirming(false);
      }
    },
    [t],
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
    /** True while addLearningItem is in flight (SensePicker Add button spinner). */
    confirming,
    /** Backward-compatible busy flag for callers that only need “any spinner”. */
    generating: lookingUp || confirming,
    error,
    suggestPosPrompt,
    lookup,
    forceExisting,
    forceWithPos,
    confirm,
    close,
  };
}

export type { PartOfSpeech };

import { useCallback, useRef, useState } from 'react';
import { addLearningItem, lookupWord } from '../api/words';
import { ApiError } from '../api/client';
import { DEFAULT_DEFINITION_LANGUAGE_CODE } from '../config';
import { useAppLanguage } from '../i18n';
import type { PartOfSpeech, PosFilter, SenseOption } from '../types';

interface SenseFlowCallbacks {
  onAdded?: (wordSenseId: string) => void;
  onDismiss?: () => void;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

function isNoAdditionalSensesError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && error.message.includes('no_additional_senses');
}

export function useSenseFlow(callbacks: SenseFlowCallbacks = {}) {
  const { t } = useAppLanguage();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SenseOption[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestPosPrompt, setSuggestPosPrompt] = useState(false);

  const lastText = useRef('');
  const lastPos = useRef<PosFilter>('Any');
  const lastSourceContext = useRef('');
  const lastLanguageCode = useRef<string | undefined>(undefined);
  const lastDeckId = useRef<string | undefined>(undefined);

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
      setGenerating(true);
      setOptions([]);
      setPickerVisible(true);
      try {
        const response = await lookupWord(trimmed, {
          partOfSpeech: posFilter,
          sourceContext: lastSourceContext.current || undefined,
          languageCode,
        });
        setOptions(response.sense_options);
        return true;
      } catch (err) {
        if (isNoAdditionalSensesError(err)) {
          setError(t('sense.noAdditionalSenses'));
        } else {
          setError(messageOf(err, t('common.somethingWrong')));
        }
        return false;
      } finally {
        setGenerating(false);
      }
    },
    [t],
  );

  const forceExisting = useCallback(
    async (wordId: string) => {
      setError(null);
      setSuggestPosPrompt(false);
      setGenerating(true);
      try {
        const response = await lookupWord(lastText.current, {
          wordId,
          force: true,
          sourceContext: lastSourceContext.current || undefined,
          languageCode: lastLanguageCode.current,
        });
        setOptions(response.sense_options);
      } catch (err) {
        if (isNoAdditionalSensesError(err)) {
          setError(t('sense.noAdditionalSenses'));
          setSuggestPosPrompt(true);
        } else {
          setError(messageOf(err, t('common.somethingWrong')));
        }
      } finally {
        setGenerating(false);
      }
    },
    [t],
  );

  const forceWithPos = useCallback(
    async (pos: PartOfSpeech) => {
      setError(null);
      setSuggestPosPrompt(false);
      setGenerating(true);
      try {
        const response = await lookupWord(lastText.current, {
          partOfSpeech: pos,
          force: true,
          sourceContext: lastSourceContext.current || undefined,
          languageCode: lastLanguageCode.current,
        });
        setOptions(response.sense_options);
      } catch (err) {
        if (isNoAdditionalSensesError(err)) {
          setError(t('sense.noAdditionalSenses'));
          setSuggestPosPrompt(true);
        } else {
          setError(messageOf(err, t('common.somethingWrong')));
        }
      } finally {
        setGenerating(false);
      }
    },
    [t],
  );

  const confirm = useCallback(
    async (wordSenseId: string, deckId?: string, sourceContext?: string) => {
      setError(null);
      setGenerating(true);
      try {
        const resolvedDeck = deckId ?? lastDeckId.current;
        const resolvedContext = (sourceContext ?? lastSourceContext.current).trim();
        await addLearningItem(
          wordSenseId,
          DEFAULT_DEFINITION_LANGUAGE_CODE,
          resolvedDeck,
          resolvedContext || undefined,
        );
        setPickerVisible(false);
        callbacks.onAdded?.(wordSenseId);
      } catch (err) {
        setError(messageOf(err, t('common.somethingWrong')));
      } finally {
        setGenerating(false);
      }
    },
    [callbacks, t],
  );

  const close = useCallback(() => {
    setPickerVisible(false);
    callbacks.onDismiss?.();
  }, [callbacks]);

  return {
    pickerVisible,
    query,
    options,
    generating,
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

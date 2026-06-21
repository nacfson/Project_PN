import { useCallback, useState } from 'react';
import { previewAnkiImport, importAnkiCards } from '../../api/import';
import type {
  AnkiCard,
  AnkiImportResult,
  ImportAction,
  ImportPreviewItem,
  ImportPreviewResponse,
} from '../../types';

interface UseAnkiImportOptions {
  languageCode: string;
  definitionLanguageCode: string;
}

export function useAnkiImport({ languageCode, definitionLanguageCode }: UseAnkiImportOptions) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [actions, setActions] = useState<Record<number, ImportAction>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnkiImportResult | null>(null);

  const previewFromText = useCallback(async () => {
    if (!csvText.trim()) {
      setError('Paste Anki CSV export first');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('text', csvText);
      formData.append('language_code', languageCode);
      formData.append('definition_language_code', definitionLanguageCode);
      const data = await previewAnkiImport(formData);
      setPreview(data);
      const initialActions: Record<number, ImportAction> = {};
      data.items.forEach((item) => {
        initialActions[item.index] = item.suggested_action;
      });
      setActions(initialActions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  }, [csvText, languageCode, definitionLanguageCode]);

  const setCardAction = useCallback((index: number, action: ImportAction) => {
    setActions((prev) => ({ ...prev, [index]: action }));
  }, []);

  const importCards = useCallback(async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const cardsWithActions: AnkiCard[] = preview.cards.map((card, index) => ({
        ...card,
        action: actions[index] ?? preview.items.find((i) => i.index === index)?.suggested_action ?? 'skip',
      }));
      const data = await importAnkiCards({
        cards: cardsWithActions,
        language_code: languageCode,
        definition_language_code: definitionLanguageCode,
      });
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [preview, actions, languageCode, definitionLanguageCode]);

  const reset = useCallback(() => {
    setCsvText('');
    setPreview(null);
    setActions({});
    setError(null);
    setResult(null);
  }, []);

  return {
    csvText,
    setCsvText,
    preview,
    actions,
    loading,
    importing,
    error,
    result,
    previewFromText,
    setCardAction,
    importCards,
    reset,
  };
}

import { postJson, postFormData } from './client';
import type {
  AnkiCard,
  AnkiImportRequest,
  AnkiImportResult,
  ImportPreviewResponse,
} from '../types';

export async function previewAnkiImport(formData: FormData): Promise<ImportPreviewResponse> {
  return postFormData<ImportPreviewResponse>('/api/import/anki/preview', formData);
}

export function importAnkiCards(request: AnkiImportRequest): Promise<AnkiImportResult> {
  return postJson<AnkiImportResult>('/api/import/anki', request);
}

export type { AnkiCard, AnkiImportRequest, AnkiImportResult, ImportPreviewResponse };

import { getJson, postJson } from './client';
import type { CurriculumEnrollResult, CurriculumPack, CurriculumPackDetail } from './types';

export function listCurriculumPacks(): Promise<CurriculumPack[]> {
  return getJson<{ packs: CurriculumPack[] }>('/api/curriculum/packs').then((res) => res.packs);
}

export function getCurriculumPack(slug: string, previewLimit = 50): Promise<CurriculumPackDetail> {
  const searchParams = new URLSearchParams();
  if (previewLimit) {
    searchParams.set('preview_limit', String(previewLimit));
  }
  return getJson<CurriculumPackDetail>(`/api/curriculum/packs/${encodeURIComponent(slug)}?${searchParams}`);
}

export function enrollCurriculumPack(slug: string): Promise<CurriculumEnrollResult> {
  return postJson<CurriculumEnrollResult>(`/api/curriculum/packs/${encodeURIComponent(slug)}/enroll`, {});
}

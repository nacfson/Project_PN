import { deleteJson, getJson, patchJson, postJson } from './client';
import type { UserLanguage } from '../types/auth';

export interface UserLanguagesResponse {
  languages: UserLanguage[];
}

export async function getUserLanguages(): Promise<UserLanguage[]> {
  const response = await getJson<UserLanguagesResponse>('/api/user/languages');
  return response.languages ?? [];
}

export async function addUserLanguage(
  targetLanguage: string,
  displayLanguage: string,
  setActive: boolean,
): Promise<UserLanguage> {
  return postJson<UserLanguage>('/api/user/languages', {
    target_language: targetLanguage,
    display_language: displayLanguage,
    set_active: setActive,
  });
}

export async function setActiveUserLanguage(targetLanguage: string): Promise<void> {
  await patchJson<void>(`/api/user/languages/${targetLanguage}/active`, {});
}

export async function updateDisplayLanguage(targetLanguage: string, displayLanguage: string): Promise<void> {
  await patchJson<void>(`/api/user/languages/${targetLanguage}`, {
    display_language: displayLanguage,
  });
}

export async function updateLanguagePair(
  targetLanguage: string,
  newTargetLanguage: string,
  displayLanguage: string,
): Promise<void> {
  await patchJson<void>(`/api/user/languages/${targetLanguage}`, {
    new_target_language: newTargetLanguage,
    display_language: displayLanguage,
  });
}

export async function removeUserLanguage(targetLanguage: string): Promise<void> {
  await deleteJson<void>(`/api/user/languages/${targetLanguage}`);
}

import { getJson, postNoContent } from './client';
import type { LanguageOptionsResponse, MeResponse } from './types';

export function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  return getJson<LanguageOptionsResponse>('/api/auth/language-options', { auth: false });
}

export function me(): Promise<MeResponse> {
  return getJson<MeResponse>('/api/auth/me');
}

export function logout(): Promise<void> {
  return postNoContent('/api/auth/logout');
}

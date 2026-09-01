import { getJson, postJson, postNoContent } from './client';
import type { LanguageOptionsResponse, MeResponse, SessionResponse } from './types';

export function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  return getJson<LanguageOptionsResponse>('/api/auth/language-options', { auth: false });
}

export function me(): Promise<MeResponse> {
  return getJson<MeResponse>('/api/auth/me');
}

export function refreshSession(refreshToken: string): Promise<SessionResponse> {
  return postJson<SessionResponse>('/api/auth/refresh', { refresh_token: refreshToken }, { auth: false });
}

export function logout(): Promise<void> {
  return postNoContent('/api/auth/logout');
}

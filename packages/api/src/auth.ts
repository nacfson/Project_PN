import { getJson, postJson, postNoContent } from './client';
import type {
  LanguageOptionsResponse,
  LinkedProvider,
  MeResponse,
  MergeRequestResponse,
  MergeSuggestion,
  SessionResponse,
} from './types';

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

export function getLinkedProviders(): Promise<LinkedProvider[]> {
  return getJson<LinkedProvider[]>('/api/auth/linked-providers');
}

export function linkProvider(): Promise<void> {
  return postNoContent('/api/auth/link-provider');
}

export function getMergeSuggestions(): Promise<MergeSuggestion[]> {
  return getJson<MergeSuggestion[]>('/api/auth/merge-suggestions');
}

export function createMergeRequest(sourceUserId: string): Promise<MergeRequestResponse> {
  return postJson<MergeRequestResponse>('/api/auth/merge-requests', { source_user_id: sourceUserId });
}

export function confirmMergeRequest(requestId: string): Promise<void> {
  return postNoContent(`/api/auth/merge-requests/${encodeURIComponent(requestId)}/confirm`);
}

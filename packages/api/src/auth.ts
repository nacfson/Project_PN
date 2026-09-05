import { getJson, postJson, postNoContent } from './client';
import type {
  LanguageOptionsResponse,
  LinkRequest,
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

export function createLinkRequest(): Promise<LinkRequest> {
  return postJson<LinkRequest>('/api/auth/link-requests', {});
}

export function getCurrentLinkRequest(): Promise<LinkRequest | null> {
  return getJson<LinkRequest | null>('/api/auth/link-requests/current');
}

export function resendLinkRequest(requestId: string): Promise<LinkRequest> {
  return postJson<LinkRequest>(`/api/auth/link-requests/${encodeURIComponent(requestId)}/resend`, {});
}

export function cancelLinkRequest(requestId: string): Promise<void> {
  return postNoContent(`/api/auth/link-requests/${encodeURIComponent(requestId)}/cancel`);
}

export function confirmLinkRequest(requestId: string): Promise<void> {
  return postNoContent(`/api/auth/link-requests/${encodeURIComponent(requestId)}/confirm`);
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

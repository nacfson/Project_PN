import { getJson, postNoContent } from './client';
import type { LanguageOptionsResponse, LoginRequest, MeResponse, SessionResponse } from './types';

export async function createSession(
  centralAuthUrl: string,
  body: LoginRequest,
): Promise<SessionResponse> {
  const url = `${centralAuthUrl}/api/auth/session`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network request failed. Is central auth running? (${message})`);
  }

  const text = await response.text();
  let parsed: ({ error?: string } & SessionResponse) | null = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as { error?: string } & SessionResponse;
    } catch {
      throw new Error(`Central auth returned non-JSON (status ${response.status}): ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok) {
    throw new Error(parsed?.error ?? `Login failed (${response.status})`);
  }
  if (!parsed?.token) {
    throw new Error('Central auth did not return a session token.');
  }
  return parsed;
}

export function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  return getJson<LanguageOptionsResponse>('/api/auth/language-options', { auth: false });
}

export function me(): Promise<MeResponse> {
  return getJson<MeResponse>('/api/auth/me');
}

export function logout(): Promise<void> {
  return postNoContent('/api/auth/logout');
}

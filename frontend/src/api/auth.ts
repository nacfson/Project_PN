import {
  CENTRAL_AUTH_URL,
} from '../config';
import type {
  LanguageOptionsResponse,
  LoginRequest,
  MeResponse,
  SessionResponse,
} from '../types/auth';
import { ApiError, getJson, postNoContent } from './client';
import { sessionStorage } from './storage';

const noAuth = { auth: false as const };

export async function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  return getJson<LanguageOptionsResponse>('/api/auth/language-options', noAuth);
}

export async function login(email: string, password: string): Promise<SessionResponse> {
  const body: LoginRequest = { email, password };
  const session = await centralLogin(body);
  await sessionStorage.setToken(session.token);
  return session;
}

export async function me(): Promise<MeResponse> {
  return getJson<MeResponse>('/api/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await postNoContent('/api/auth/logout');
  } finally {
    await sessionStorage.removeToken();
  }
}

async function centralLogin(body: LoginRequest): Promise<SessionResponse> {
  if (!CENTRAL_AUTH_URL) {
    throw new ApiError(0, 'Central auth URL is not configured.');
  }

  const url = `${CENTRAL_AUTH_URL}/api/auth/session`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `Network request failed. Is central auth running? (${message})`);
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? 'unknown';

  let parsed: ({ error?: string } & SessionResponse) | null = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as { error?: string } & SessionResponse;
    } catch (parseErr) {
      const preview = text.slice(0, 200).replace(/\s+/g, ' ');
      throw new ApiError(
        response.status,
        `Central auth returned non-JSON (status ${response.status}, content-type ${contentType}): ${preview}`,
      );
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, parsed?.error ?? `Request failed (${response.status})`);
  }
  if (!parsed?.token) {
    throw new ApiError(502, 'Central auth did not return a session token.');
  }
  return parsed;
}

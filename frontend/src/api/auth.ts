import {
  CENTRAL_AUTH_URL,
  DEFAULT_DEFINITION_LANGUAGE_CODE,
  DEFAULT_LANGUAGE_CODE,
  IS_CENTRAL_AUTH,
} from '../config';
import type {
  LanguageOptionsResponse,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  SessionResponse,
  VerifyEmailRequest,
} from '../types/auth';
import { ApiError, getJson, postJson, postNoContent } from './client';
import { sessionStorage } from './storage';

const noAuth = { auth: false as const };

export async function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  return getJson<LanguageOptionsResponse>('/api/auth/language-options', noAuth);
}

export async function register(
  email: string,
  password: string,
  langs?: { nativeLanguage?: string; targetLanguage?: string },
): Promise<void> {
  if (IS_CENTRAL_AUTH) {
    throw new ApiError(400, 'Account creation is managed by the central auth platform.');
  }
  const body: RegisterRequest = {
    email,
    password,
    native_language: langs?.nativeLanguage ?? DEFAULT_DEFINITION_LANGUAGE_CODE,
    target_language: langs?.targetLanguage ?? DEFAULT_LANGUAGE_CODE,
  };
  await postJson<void>('/api/auth/register', body, noAuth);
}

export async function login(email: string, password: string): Promise<SessionResponse> {
  const body: LoginRequest = { email, password };
  const session = IS_CENTRAL_AUTH
    ? await centralLogin(body)
    : await postJson<SessionResponse>('/api/auth/login', body, noAuth);
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

export async function requestVerificationEmail(email: string): Promise<void> {
  if (IS_CENTRAL_AUTH) {
    throw new ApiError(400, 'Email verification is managed by the central auth platform.');
  }
  const body: VerifyEmailRequest = { email };
  await postNoContent('/api/auth/verify-email/request', body, noAuth);
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

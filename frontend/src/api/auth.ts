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

  let response: Response;
  try {
    response = await fetch(`${CENTRAL_AUTH_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is central auth running?');
  }

  const text = await response.text();
  const parsed = text.length > 0 ? (JSON.parse(text) as { error?: string } & SessionResponse) : null;
  if (!response.ok) {
    throw new ApiError(response.status, parsed?.error ?? `Request failed (${response.status})`);
  }
  if (!parsed?.token) {
    throw new ApiError(502, 'Central auth did not return a session token.');
  }
  return parsed;
}

import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import type {
  LanguageOptionsResponse,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  SessionResponse,
  VerifyEmailRequest,
} from '../types/auth';
import { getJson, postJson, postNoContent } from './client';
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
  const session = await postJson<SessionResponse>('/api/auth/login', body, noAuth);
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
  const body: VerifyEmailRequest = { email };
  await postNoContent('/api/auth/verify-email/request', body, noAuth);
}

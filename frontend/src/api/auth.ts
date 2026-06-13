import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import type {
  ExchangeRequest,
  LoginRequest,
  MagicLinkRequest,
  MeResponse,
  RegisterRequest,
  SessionResponse,
} from '../types/auth';
import { getJson, postJson, postNoContent } from './client';
import { sessionStorage } from './storage';

const noAuth = { auth: false as const };

export async function register(
  email: string,
  password: string,
  langs?: { nativeLanguage?: string; targetLanguage?: string },
): Promise<SessionResponse> {
  const body: RegisterRequest = {
    email,
    password,
    native_language: langs?.nativeLanguage ?? DEFAULT_DEFINITION_LANGUAGE_CODE,
    target_language: langs?.targetLanguage ?? DEFAULT_LANGUAGE_CODE,
  };
  const session = await postJson<SessionResponse>('/api/auth/register', body, noAuth);
  await sessionStorage.setToken(session.token);
  return session;
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

export async function requestMagicLink(email: string): Promise<void> {
  const body: MagicLinkRequest = { email };
  await postNoContent('/api/auth/magic-link', body, noAuth);
}

export async function exchangeMagicCode(code: string): Promise<SessionResponse> {
  const body: ExchangeRequest = { code };
  const session = await postJson<SessionResponse>('/api/auth/magic/exchange', body, noAuth);
  await sessionStorage.setToken(session.token);
  return session;
}

export async function loginWithGoogle(idToken: string): Promise<SessionResponse> {
  const session = await postJson<SessionResponse>(
    '/api/auth/oauth/google',
    { id_token: idToken },
    noAuth,
  );
  await sessionStorage.setToken(session.token);
  return session;
}

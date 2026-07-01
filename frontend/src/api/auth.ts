import { CENTRAL_AUTH_URL } from '../config';
import type { LanguageOptionsResponse, LoginRequest, MeResponse, SessionResponse } from '@project-pn/api';
import {
  createSession as createSessionApi,
  getLanguageOptions as getLanguageOptionsApi,
  logout as logoutApi,
  me as meApi,
} from './client';
import { sessionStorage } from './storage';

export async function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  return getLanguageOptionsApi();
}

export async function login(email: string, password: string): Promise<SessionResponse> {
  if (!CENTRAL_AUTH_URL) {
    throw new Error('Central auth URL is not configured.');
  }
  const body: LoginRequest = { email, password };
  const session = await createSessionApi(CENTRAL_AUTH_URL, body);
  await sessionStorage.setToken(session.token);
  return session;
}

export async function me(): Promise<MeResponse> {
  return meApi();
}

export async function logout(): Promise<void> {
  try {
    await logoutApi();
  } finally {
    await sessionStorage.removeToken();
  }
}

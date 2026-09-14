import type { SessionResponse } from './types';
import { createUUID } from './analytics';

export interface ApiConfig {
  baseUrls: string[];
  fetchImpl?: typeof fetch;
  getToken: () => Promise<string | null>;
  authMode?: 'bearer' | 'cookie';
  getCsrfToken?: () => string | null | Promise<string | null>;
  getRefreshToken?: () => Promise<string | null>;
  onSessionRefreshed?: (session: SessionResponse) => void | Promise<void>;
  onUnauthorized?: () => void;
}

let config: ApiConfig | undefined;
let lastWorkingBaseUrl: string | undefined;
const bearerScheme = String.fromCharCode(66, 101, 97, 114, 101, 114);
let refreshPromise: Promise<SessionResponse | null> | null = null;

export function configureApi(c: ApiConfig): void {
  config = c;
}

type UnauthorizedCallback = () => void;
const unauthorizedListeners: UnauthorizedCallback[] = [];

export function onUnauthorized(callback: UnauthorizedCallback): () => void {
  unauthorizedListeners.push(callback);
  return () => {
    const index = unauthorizedListeners.indexOf(callback);
    if (index !== -1) unauthorizedListeners.splice(index, 1);
  };
}

function notifyUnauthorized(): void {
  config?.onUnauthorized?.();
  unauthorizedListeners.forEach((cb) => cb());
}

function getConfig(): ApiConfig {
  if (!config) {
    throw new Error('ApiClient not configured. Call configureApi() first.');
  }
  return config;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;

  constructor(status: number, message: string, code?: string, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

interface ErrorBody {
  error?: string;
  code?: string;
  retryable?: boolean;
}

export interface RequestOptions {
  /** When false, omit Authorization even if a token is stored. Default true. */
  auth?: boolean;
  /** Correlates an API result with a semantic client event. */
  traceId?: string;
}

function usesCookieAuth(): boolean {
  return getConfig().authMode === 'cookie';
}

function requestCredentials(): RequestCredentials | undefined {
  return usesCookieAuth() ? 'include' : undefined;
}

function canRefreshSession(path: string, options?: RequestOptions): boolean {
  if (usesCookieAuth() || options?.auth === false || path === '/api/auth/refresh') {
    return false;
  }
  return typeof getConfig().getRefreshToken === 'function';
}

async function attemptRefresh(): Promise<SessionResponse | null> {
  const cfg = getConfig();
  if (!cfg.getRefreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await cfg.getRefreshToken!();
        if (!refreshToken) {
          return null;
        }
        const { refreshSession } = await import('./auth');
        const session = await refreshSession(refreshToken);
        await cfg.onSessionRefreshed?.(session);
        return session;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function buildHeaders(options?: RequestOptions, mutation = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Client-Trace-Id': options?.traceId ?? createUUID() };
  if (!usesCookieAuth() && options?.auth !== false) {
    const token = await getConfig().getToken();
    if (token) {
      headers.Authorization = `${bearerScheme} ${token}`;
    }
  }
  if (usesCookieAuth() && mutation) {
    const csrfToken = await getConfig().getCsrfToken?.();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return headers;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(response.status, 'The server returned an invalid response.', 'API-599', true);
  }
}

/**
 * Client wait budget for API calls.
 * Covers slow WiktApi (~20s) plus Gemini/OpenAI enrich fallback so lookup/add
 * can finish with HTTP 200 instead of aborting early as status 0 → ADD-101.
 * Keep in sync with edge proxy_read_timeout / proxy_send_timeout (≥ 60s).
 */
export const API_LAST_WORKING_TIMEOUT_MS = 60_000;
export const API_PROBE_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetchImpl(url, init),
      timeoutPromise
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchWithFallback(path: string, init: RequestInit): Promise<Response> {
  const errors: string[] = [];
  
  const urls = [...getConfig().baseUrls];
  if (lastWorkingBaseUrl && urls.includes(lastWorkingBaseUrl)) {
    const index = urls.indexOf(lastWorkingBaseUrl);
    urls.splice(index, 1);
    urls.unshift(lastWorkingBaseUrl);
  }

  for (const baseUrl of urls) {
    try {
      const fetchImpl = getConfig().fetchImpl ?? fetch;
      
      const isLastWorking = baseUrl === lastWorkingBaseUrl;
      const timeoutMs = isLastWorking ? API_LAST_WORKING_TIMEOUT_MS : API_PROBE_TIMEOUT_MS;
      
      const response = await fetchWithTimeout(
        fetchImpl,
        `${baseUrl}${path}`,
        init,
        timeoutMs
      );
      
      lastWorkingBaseUrl = baseUrl;
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${baseUrl}: ${message}`);
    }
  }
  throw new Error(`All API endpoints failed: ${errors.join('; ')}`);
}

async function handleUnauthorized(
  response: Response,
  parsed: unknown,
  path: string,
  options: RequestOptions | undefined,
  retry: () => Promise<Response>,
): Promise<Response> {
  if (response.status !== 401) {
    return response;
  }

  if (canRefreshSession(path, options)) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return retry();
    }
  }

  notifyUnauthorized();
  return response;
}

function throwOnError(response: Response, parsed: unknown): void {
  if (!response.ok) {
    const body = parsed as ErrorBody | null;
    const message = body?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message, body?.code, body?.retryable === true);
  }
}

export async function getJson<TResponse>(path: string, options?: RequestOptions): Promise<TResponse> {
  const execute = async (): Promise<Response> => {
    const headers = await buildHeaders(options);
    return fetchWithFallback(path, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      credentials: requestCredentials(),
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, 'Network request failed: ' + msg);
  }

  let parsed = await parseResponse(response);
  const originalOk = response.ok;
  response = await handleUnauthorized(response, parsed, path, options, execute);
  if (!originalOk || !response.ok) {
    parsed = await parseResponse(response);
  }
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function postJson<TResponse>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<TResponse> {
  const execute = async (): Promise<Response> => {
    return fetchWithFallback(path, {
      method: 'POST',
      headers: await buildHeaders(options, true),
      body: JSON.stringify(body),
      credentials: requestCredentials(),
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  let parsed = await parseResponse(response);
  const originalOk = response.ok;
  response = await handleUnauthorized(response, parsed, path, options, execute);
  if (!originalOk || !response.ok) {
    parsed = await parseResponse(response);
  }
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function patchJson<TResponse>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<TResponse> {
  const execute = async (): Promise<Response> => {
    return fetchWithFallback(path, {
      method: 'PATCH',
      headers: await buildHeaders(options, true),
      body: JSON.stringify(body),
      credentials: requestCredentials(),
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  let parsed = await parseResponse(response);
  const originalOk = response.ok;
  response = await handleUnauthorized(response, parsed, path, options, execute);
  if (!originalOk || !response.ok) {
    parsed = await parseResponse(response);
  }
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function deleteJson<TResponse>(
  path: string,
  options?: RequestOptions,
): Promise<TResponse> {
  const execute = async (): Promise<Response> => {
    return fetchWithFallback(path, {
      method: 'DELETE',
      headers: await buildHeaders(options, true),
      credentials: requestCredentials(),
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  let parsed = await parseResponse(response);
  const originalOk = response.ok;
  response = await handleUnauthorized(response, parsed, path, options, execute);
  if (!originalOk || !response.ok) {
    parsed = await parseResponse(response);
  }
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function postFormData<TResponse>(
  path: string,
  formData: FormData,
  options?: RequestOptions,
): Promise<TResponse> {
  const execute = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!usesCookieAuth() && options?.auth !== false) {
      const token = await getConfig().getToken();
      if (token) {
        headers.Authorization = `${bearerScheme} ${token}`;
      }
    }
    if (usesCookieAuth()) {
      const csrfToken = await getConfig().getCsrfToken?.();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return fetchWithFallback(path, {
      method: 'POST',
      headers,
      body: formData,
      credentials: requestCredentials(),
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  let parsed = await parseResponse(response);
  const originalOk = response.ok;
  response = await handleUnauthorized(response, parsed, path, options, execute);
  if (!originalOk || !response.ok) {
    parsed = await parseResponse(response);
  }
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function postNoContent(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<void> {
  const execute = async (): Promise<Response> => {
    return fetchWithFallback(path, {
      method: 'POST',
      headers: await buildHeaders(options, true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: requestCredentials(),
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  if (!response.ok) {
    let parsed = await parseResponse(response);
    response = await handleUnauthorized(response, parsed, path, options, execute);
    if (!response.ok) {
      parsed = await parseResponse(response);
      throwOnError(response, parsed);
    }
  }
}

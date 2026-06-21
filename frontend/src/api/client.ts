import { API_BASE_URLS } from '../config';
import { sessionStorage } from './storage';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ErrorBody {
  error?: string;
}

interface RequestOptions {
  /** When false, omit Authorization even if a token is stored. Default true. */
  auth?: boolean;
}

async function buildHeaders(options?: RequestOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.auth !== false) {
    const token = await sessionStorage.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.length > 0 ? (JSON.parse(text) as unknown) : null;
}

function throwOnError(response: Response, parsed: unknown): void {
  if (!response.ok) {
    const message = (parsed as ErrorBody | null)?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
}

async function fetchWithFallback(path: string, init: RequestInit): Promise<Response> {
  const errors: string[] = [];
  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`API fallback failed: ${baseUrl}${path} — ${message}`);
      errors.push(`${baseUrl}: ${message}`);
    }
  }
  throw new Error(`All API endpoints failed: ${errors.join('; ')}`);
}

export async function getJson<TResponse>(path: string, options?: RequestOptions): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'GET',
      headers: await buildHeaders(options),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  const parsed = await parseResponse(response);
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function postJson<TResponse>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'POST',
      headers: await buildHeaders(options),
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  const parsed = await parseResponse(response);
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function patchJson<TResponse>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'PATCH',
      headers: await buildHeaders(options),
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  const parsed = await parseResponse(response);
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function postFormData<TResponse>(
  path: string,
  formData: FormData,
  options?: RequestOptions,
): Promise<TResponse> {
  let response: Response;
  try {
    const headers = await buildHeaders(options);
    delete headers['Content-Type'];
    response = await fetchWithFallback(path, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  const parsed = await parseResponse(response);
  throwOnError(response, parsed);
  return parsed as TResponse;
}

/** POST expecting 204 No Content (e.g. logout, magic-link request). */
export async function postNoContent(path: string, body?: unknown, options?: RequestOptions): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'POST',
      headers: await buildHeaders(options),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  if (!response.ok) {
    const parsed = await parseResponse(response);
    throwOnError(response, parsed);
  }
}

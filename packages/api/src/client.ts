export interface ApiConfig {
  baseUrls: string[];
  fetchImpl?: typeof fetch;
  getToken: () => Promise<string | null>;
  authMode?: 'bearer' | 'cookie';
  getCsrfToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
}

let config: ApiConfig | undefined;
let lastWorkingBaseUrl: string | undefined;

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

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ErrorBody {
  error?: string;
}

export interface RequestOptions {
  /** When false, omit Authorization even if a token is stored. Default true. */
  auth?: boolean;
}

function usesCookieAuth(): boolean {
  return getConfig().authMode === 'cookie';
}

function requestCredentials(): RequestCredentials | undefined {
  return usesCookieAuth() ? 'include' : undefined;
}

async function buildHeaders(options?: RequestOptions, mutation = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!usesCookieAuth() && options?.auth !== false) {
    const token = await getConfig().getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
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
  return text.length > 0 ? (JSON.parse(text) as unknown) : null;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  let timeoutId: any;
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
      const timeoutMs = isLastWorking ? 15000 : 6500;
      
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

function throwOnError(response: Response, parsed: unknown): void {
  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    const message = (parsed as ErrorBody | null)?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
}

export async function getJson<TResponse>(path: string, options?: RequestOptions): Promise<TResponse> {
  let response: Response;
  try {
    const headers = await buildHeaders(options);
    response = await fetchWithFallback(path, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      credentials: requestCredentials(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, 'Network request failed: ' + msg);
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
      headers: await buildHeaders(options, true),
      body: JSON.stringify(body),
      credentials: requestCredentials(),
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
      headers: await buildHeaders(options, true),
      body: JSON.stringify(body),
      credentials: requestCredentials(),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  const parsed = await parseResponse(response);
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function deleteJson<TResponse>(
  path: string,
  options?: RequestOptions,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'DELETE',
      headers: await buildHeaders(options, true),
      credentials: requestCredentials(),
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
  const headers: Record<string, string> = {};
  if (!usesCookieAuth() && options?.auth !== false) {
    const token = await getConfig().getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  if (usesCookieAuth()) {
    const csrfToken = await getConfig().getCsrfToken?.();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'POST',
      headers,
      body: formData,
      credentials: requestCredentials(),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  const parsed = await parseResponse(response);
  throwOnError(response, parsed);
  return parsed as TResponse;
}

export async function postNoContent(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithFallback(path, {
      method: 'POST',
      headers: await buildHeaders(options, true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: requestCredentials(),
    });
  } catch {
    throw new ApiError(0, 'Network request failed. Is the backend running?');
  }

  if (!response.ok) {
    const parsed = await parseResponse(response);
    throwOnError(response, parsed);
  }
}

import { useAuthStore } from '../../stores/auth.store';

/*
 * Phause — HTTP client.
 *
 * Thin fetch wrapper that:
 * - Prefixes every request with VITE_API_URL
 * - Attaches Authorization header from the token getter passed in
 * - Deduplicates identical in-flight GET requests (same URL + token)
 * - Retries once on 429 after the Retry-After delay (or 5 s fallback)
 * - Throws a structured ApiError on non-2xx responses
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';
export const API_BASE_URL = (configuredBase || 'https://phishingsimulation.webandappdevelopmenttech.com')
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

type TokenGetter = () => string | null;

// ── In-flight deduplication for GET requests ─────────────────────────────────
// Prevents the same GET URL from being fetched twice simultaneously.
// The cache key is `${method}:${url}:${token}`.
const inFlight = new Map<string, Promise<unknown>>();

// ── Small delay helper ────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function request<T>(
  method: string,
  path: string,
  getToken: TokenGetter | null,
  body?: unknown,
  _retrying = false,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken?.();
  if (getToken && !token) {
    throw new ApiError(401, null, 'Sign in is required to access this API.');
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const authState = useAuthStore.getState();
  // Always send x-tenant-id when an orgId is stored — the backend AuthGuard
  // requires it for admin tokens and ignores it for org-user tokens.
  if (authState.orgId) {
    headers['x-tenant-id'] = authState.orgId;
  }

  const url = `${API_BASE_URL}${path}`;

  // Deduplicate identical in-flight GET requests
  if (method === 'GET') {
    const dedupeKey = `GET:${url}:${token ?? ''}`;
    const existing = inFlight.get(dedupeKey);
    if (existing) return existing as Promise<T>;

    const promise = _doFetch<T>(method, url, headers, body, getToken, path, _retrying);
    inFlight.set(dedupeKey, promise);
    promise.finally(() => inFlight.delete(dedupeKey));
    return promise;
  }

  return _doFetch<T>(method, url, headers, body, getToken, path, _retrying);
}

async function _doFetch<T>(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  getToken: TokenGetter | null,
  path: string,
  _retrying: boolean,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 429 — retry once after Retry-After (or 5 s)
  if (res.status === 429 && !_retrying) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? res.headers.get('retry-after') ?? '5');
    const waitMs = Math.min((isNaN(retryAfter) ? 5 : retryAfter) * 1000, 30_000);
    await sleep(waitMs);
    // Re-build headers with fresh token in case it changed
    const freshHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const freshToken = getToken?.();
    if (freshToken) freshHeaders['Authorization'] = `Bearer ${freshToken}`;
    const authState = useAuthStore.getState();
    if (authState.orgId) {
      freshHeaders['x-tenant-id'] = authState.orgId;
    }
    const retry = await fetch(url, {
      method,
      headers: freshHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return _handleResponse<T>(retry, method, path, getToken);
  }

  return _handleResponse<T>(res, method, path, getToken);
}

async function _handleResponse<T>(
  res: Response,
  method: string,
  path: string,
  getToken: TokenGetter | null,
): Promise<T> {
  if (!res.ok) {
    // Only clear the session on 401 when:
    // 1. The request used a token (getToken is set), AND
    // 2. The path is NOT an admin-only endpoint (those use adminToken which
    //    should never clear the org user's appToken session).
    if (res.status === 401 && getToken) {
      const isAdminPath = path.startsWith('/api/admin/');
      if (!isAdminPath) {
        useAuthStore.getState().clearAll();
      }
    }
    let errBody: unknown;
    try { errBody = await res.json(); } catch { errBody = await res.text(); }
    throw new ApiError(res.status, errBody, `${method} ${path} → ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const apiClient = {
  get:    <T>(path: string, getToken: TokenGetter | null = null)             => request<T>('GET',    path, getToken),
  post:   <T>(path: string, getToken: TokenGetter | null, body?: unknown)    => request<T>('POST',   path, getToken, body),
  patch:  <T>(path: string, getToken: TokenGetter | null, body?: unknown)    => request<T>('PATCH',  path, getToken, body),
  delete: <T>(path: string, getToken: TokenGetter | null)                    => request<T>('DELETE', path, getToken),
};

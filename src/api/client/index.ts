import { useAuthStore } from '../../stores/auth.store';
import { refreshToken } from '../auth/auth.api';

/*
 * Phause — HTTP client.
 *
 * Thin fetch wrapper that:
 * - Prefixes every request with VITE_API_URL
 * - Attaches Authorization header from the token getter passed in
 * - Deduplicates identical in-flight GET requests (same URL + token)
 * - Retries once on 429 after the Retry-After delay (or 5 s fallback)
 * - On 401: attempts a silent token refresh once, then retries the original
 *   request with the new token.  Only clears the session if the refresh also
 *   fails (i.e. the token is truly expired/invalid).
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

// ── Single in-progress refresh guard ─────────────────────────────────────────
// Ensures that if multiple requests 401 at the same time, only one refresh
// call is made.  All waiting requests reuse the same promise.
let refreshPromise: Promise<string | null> | null = null;

async function _attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
<<<<<<< HEAD
    const { appToken, adminToken, setAppToken, setAdminToken, setRefreshToken, clearAll } = useAuthStore.getState();
    // Only attempt refresh for org users (appToken). Admin tokens don't use refresh tokens.
    const isOrgUser = Boolean(appToken) && !adminToken;
    if (!isOrgUser) return null;

    try {
      const result = await refreshToken();
      // Store the new (rotated) access token
      setAppToken(result.accessToken, result.user.orgId, result.user.permissions);
      // Store the rotated refresh token — old one is now invalid
      setRefreshToken(result.refreshToken);
=======
    const { appToken, adminToken, setAppToken, setAdminToken, clearAll } = useAuthStore.getState();
    // Prefer appToken; fall back to adminToken
    const token = appToken ?? adminToken;
    if (!token) return null;

    try {
      const result = await refreshToken(token);
      // Persist the new token back into the store
      if (appToken) {
        setAppToken(result.accessToken, result.user.orgId, result.user.permissions);
      } else {
        // admin token
        setAdminToken(result.accessToken);
      }
>>>>>>> f47d16e36415b765f36e572c14a58b186c4f138d
      return result.accessToken;
    } catch {
      // Refresh failed — token is truly dead, clear the session
      clearAll();
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

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
    return _handleResponse<T>(retry, method, url, path, getToken, body, _retrying);
  }

  return _handleResponse<T>(res, method, url, path, getToken, body, _retrying);
}

async function _handleResponse<T>(
  res: Response,
  method: string,
  url: string,
  path: string,
  getToken: TokenGetter | null,
  body: unknown,
  _retrying: boolean,
): Promise<T> {
  if (!res.ok) {
    // ── 401 handling: try refresh first, then retry once ─────────────────────
    if (res.status === 401 && getToken && !_retrying) {
      const isAdminPath = path.startsWith('/api/admin/');

      // Admin paths use a separate token flow; don't attempt an org-user
      // refresh for them — just clear and bail.
      if (isAdminPath) {
        useAuthStore.getState().clearAll();
      } else {
        // Attempt a silent token refresh
        const newToken = await _attemptRefresh();
        if (newToken) {
          // Refresh succeeded — retry the original request with the new token
          const freshHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          };
          const authState = useAuthStore.getState();
          if (authState.orgId) freshHeaders['x-tenant-id'] = authState.orgId;

          const retryRes = await fetch(url, {
            method,
            headers: freshHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
          // Pass _retrying=true so a second 401 on the retry goes straight to
          // error — prevents any possibility of an infinite loop.
          return _handleResponse<T>(retryRes, method, url, path, getToken, body, true);
        }
        // _attemptRefresh already called clearAll() on failure
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

/**
 * Phause — Auth API helpers.
 *
 * These calls bypass the main apiClient intentionally — the refresh call must
 * NOT go through the 401-interceptor (it would create an infinite loop), so
 * it uses a raw fetch instead.
 */

import { API_BASE_URL } from '../client';
import { getRefreshToken } from '../../stores/auth.store';

export interface RefreshResponse {
  accessToken: string;
  /** Rotated refresh token — must be stored immediately to replace the old one */
  refreshToken: string;
  user: {
    id: string;
    orgId: string;
    email: string;
    role: string;
    permissions: string[];
    hasConsent: boolean;
  };
}

/**
 * Calls POST /api/auth/refresh with the stored opaque refresh token in the
 * request body.  Returns a new accessToken + rotated refreshToken + user on
 * success.  Throws if the token is invalid, expired, or not stored.
 *
 * NOTE: Do NOT pass the access token here.  The backend expects:
 *   { "refreshToken": "<opaque-96-char-hex>" }
 * NOT an Authorization: Bearer header.
 */
export async function refreshToken(): Promise<RefreshResponse> {
  const storedRefreshToken = getRefreshToken();

  if (!storedRefreshToken) {
    throw new Error('No refresh token stored — please sign in again.');
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken: storedRefreshToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Token refresh failed (${res.status})`,
    );
  }

  return res.json() as Promise<RefreshResponse>;
}

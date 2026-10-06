/**
 * Phause — Auth API helpers.
 *
 * These calls bypass the main apiClient intentionally — the refresh call must
 * NOT go through the 401-interceptor (it would create an infinite loop), so
 * it uses a raw fetch instead.
 */

import { API_BASE_URL } from '../client';
<<<<<<< HEAD
import { getRefreshToken } from '../../stores/auth.store';

export interface RefreshResponse {
  accessToken: string;
  /** Rotated refresh token — must be stored immediately to replace the old one */
  refreshToken: string;
=======

export interface RefreshResponse {
  accessToken: string;
>>>>>>> f47d16e36415b765f36e572c14a58b186c4f138d
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
<<<<<<< HEAD
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

=======
 * Calls POST /api/auth/refresh with the current token.
 * Returns a new accessToken + user on success.
 * Throws if the token is too old or the user is deactivated.
 */
export async function refreshToken(currentToken: string): Promise<RefreshResponse> {
>>>>>>> f47d16e36415b765f36e572c14a58b186c4f138d
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
<<<<<<< HEAD
    },
    body: JSON.stringify({ refreshToken: storedRefreshToken }),
=======
      Authorization: `Bearer ${currentToken}`,
    },
>>>>>>> f47d16e36415b765f36e572c14a58b186c4f138d
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Token refresh failed (${res.status})`,
    );
  }

  return res.json() as Promise<RefreshResponse>;
}

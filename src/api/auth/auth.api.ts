/**
 * Phause — Auth API helpers.
 *
 * These calls bypass the main apiClient intentionally — the refresh call must
 * NOT go through the 401-interceptor (it would create an infinite loop), so
 * it uses a raw fetch instead.
 */

import { API_BASE_URL } from '../client';

export interface RefreshResponse {
  accessToken: string;
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
 * Calls POST /api/auth/refresh with the current token.
 * Returns a new accessToken + user on success.
 * Throws if the token is too old or the user is deactivated.
 */
export async function refreshToken(currentToken: string): Promise<RefreshResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Token refresh failed (${res.status})`,
    );
  }

  return res.json() as Promise<RefreshResponse>;
}

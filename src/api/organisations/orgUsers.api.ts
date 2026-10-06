/*
 * Phause — Org Users API (Steps 2.1–2.4 from Postman).
 *
 * Super-admin routes use adminToken + x-tenant-id header.
 * Endpoints (all under /api/admin/):
 *   GET    /api/admin/users              (x-tenant-id: orgId)
 *   POST   /api/admin/users              — create user
 *   PATCH  /api/admin/users/:id          — update role/active/consent
 *   DELETE /api/admin/users/:id          — permanently delete user (204)
 */

import { API_BASE_URL, ApiError } from '../client';
import { getAdminToken, useAuthStore } from '../../stores/auth.store';
import type { OrgUserRecord } from '../../pages/organisations/OrgUser';

const BASE = API_BASE_URL;

export interface AdminOrganizationOption {
  id: string;
  name: string;
  region: string;
}

/** Org users need both adminToken AND x-tenant-id header — custom fetch. */
async function adminFetch<T>(
  method: string,
  path: string,
  body?: unknown,
  requireOrgId = true,
): Promise<T> {
  const orgId = useAuthStore.getState().orgId;
  const token = getAdminToken();
  if (!token) throw new ApiError(401, null, 'Admin sign in is required.');
  if (requireOrgId && path.includes('/users') && !orgId) throw new Error('Select an organization before managing users.');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['x-tenant-id'] = orgId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Never clearAll() on admin-token requests — a 401 should not wipe the session.
    let errBody: unknown;
    try { errBody = await res.json(); } catch { errBody = await res.text(); }
    throw new ApiError(res.status, errBody, `${method} ${path} → ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function adapt(raw: Record<string, unknown>): OrgUserRecord {
  return {
    id:         String(raw.id ?? raw.userId ?? raw.user_id ?? ''),
    orgId:      String(raw.orgId ?? raw.organizationId ?? raw.org_id ?? ''),
    email:      String(raw.email ?? ''),
    role:       String(raw.role ?? 'org_admin'),
    active:     Boolean(raw.active ?? true),
    hasConsent: Boolean(raw.hasConsent ?? raw.has_consent ?? true),
  };
}

export async function listAdminOrganizations(): Promise<AdminOrganizationOption[]> {
  const raw = await adminFetch<unknown[]>('GET', '/api/admin/organizations', undefined, false);
  if (!Array.isArray(raw)) throw new Error('The admin organizations API returned an invalid response.');
  return raw.map((value) => {
    const item = value as Record<string, unknown>;
    return { id: String(item.id ?? ''), name: String(item.name ?? ''), region: String(item.region ?? '') };
  });
}

/** Fetch ALL users across every organisation (no org filter). */
export async function listAllOrgUsers(): Promise<OrgUserRecord[]> {
  const raw = await adminFetch<unknown[]>('GET', '/api/admin/users/all', undefined, false);
  if (!Array.isArray(raw)) throw new Error('The organization users API returned an invalid response.');
  // Filter out inactive users — the backend soft-deletes by setting active:false.
  return raw
    .map((r) => adapt(r as Record<string, unknown>))
    .filter((u) => u.active);
}

export async function listOrgUsers(): Promise<OrgUserRecord[]> {
  const raw = await adminFetch<unknown[]>('GET', '/api/admin/users');
  if (!Array.isArray(raw)) throw new Error('The organization users API returned an invalid response.');
  return raw
    .map((r) => adapt(r as Record<string, unknown>))
    .filter((u) => u.active);
}

export async function createOrgUser(values: {
  email: string; password: string; role: string; hasConsent: boolean;
}): Promise<OrgUserRecord> {
  const orgId = useAuthStore.getState().orgId;
  if (!orgId) throw new Error('Select an organization before creating a user.');
  const raw = await adminFetch<Record<string, unknown>>('POST', '/api/admin/users', {
    orgId, ...values,
  });
  // response wraps user under .user
  const user = (raw.user ?? raw) as Record<string, unknown>;
  return adapt({ ...user, orgId });
}

export async function updateOrgUser(userId: string, values: {
  role: string; active: boolean; hasConsent: boolean;
}): Promise<OrgUserRecord> {
  const raw = await adminFetch<Record<string, unknown>>(
    'PATCH', `/api/admin/users/${encodeURIComponent(userId)}`, values,
  );
  return adapt(raw.user ? (raw.user as Record<string, unknown>) : raw);
}

export async function deleteOrgUser(userId: string): Promise<void> {
  await adminFetch<void>('DELETE', `/api/admin/users/${encodeURIComponent(userId)}`);
}

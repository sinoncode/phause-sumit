/*
 * Phause — Organisations API (Steps 4.1–4.3 + Step 5.1 from Postman).
 *
 * Org routes use appToken (Bearer).
 * Admin-only routes (delete) use adminToken via direct fetch.
 * Endpoints:
 *   GET    /api/organizations          — list all
 *   GET    /api/organizations/:id      — get one
 *   POST   /api/organizations          — create
 *   POST   /api/organizations/:id/authorization — record RoE auth
 *   DELETE /api/admin/organizations/:id — delete (admin only)
 */

import { apiClient, API_BASE_URL, ApiError } from '../client';
import { getAppToken, getAdminToken, useAuthStore } from '../../stores/auth.store';
import type { OrganisationRecord } from '../../pages/organisations/Org';

function adapt(raw: Record<string, unknown>): OrganisationRecord {
  return {
    id:                String(raw.id ?? ''),
    name:              String(raw.name ?? ''),
    verifyDomain:      Array.isArray(raw.verifiedEmailDomains)
                         ? (raw.verifiedEmailDomains as string[])
                         : Array.isArray(raw.verifyDomain)
                           ? (raw.verifyDomain as string[])
                           : [],
    plan:              String(raw.planName ?? raw.plan ?? ''),
    authRef: {
      label: String(raw.authorizationDocRef ?? raw.authRef ?? ''),
      url:   '',
    },
    authAccept:       Boolean(raw.authorizationAccepted ?? raw.authAccept ?? false),
    authSignature:    String(raw.authorizationSignature ?? raw.signatory ?? raw.authSignature ?? ''),
    authAt:           String(raw.authorizedAt ?? raw.authAt ?? ''),
    region:           String(raw.region ?? ''),
    disclaimerEnabled: Boolean(raw.disclaimerEnabled ?? raw.disclaimer_enabled ?? false),
  };
}

export async function listOrganisations(): Promise<OrganisationRecord[]> {
  const raw = await apiClient.get<unknown[]>('/api/organizations', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The organizations API returned an invalid response.');
  return raw.map((r) => adapt(r as Record<string, unknown>));
}

export async function createOrganisation(values: {
  name: string;
  verifyDomain: string[];
  region: string;
  disclaimerEnabled: boolean;
  eventRetentionMonths: number;
}): Promise<OrganisationRecord> {
  const raw = await apiClient.post<Record<string, unknown>>('/api/organizations', getAppToken, {
    name:                 values.name,
    verifiedEmailDomains: values.verifyDomain,
    region:               values.region,
    disclaimerEnabled:    values.disclaimerEnabled,
    eventRetentionMonths: values.eventRetentionMonths,
  });
  return adapt(raw);
}

export async function recordAuthorization(
  orgId: string,
  signatory: string,
  docRef: string,
  docFile?: string,
): Promise<void> {
  await apiClient.post<unknown>(
    `/api/organizations/${encodeURIComponent(orgId)}/authorization`,
    getAppToken,
    {
      signatory,
      authorizationDocRef: docRef,
      ...(docFile ? { authorizationDocFile: docFile } : {}),
    },
  );
}

/**
 * Delete an organisation permanently (platform admin only).
 * Calls DELETE /api/admin/organizations/:id with the admin JWT.
 */
export async function deleteOrganisation(orgId: string): Promise<void> {
  const token = getAdminToken();
  if (!token) throw new ApiError(401, null, 'Admin sign in is required.');

  // Build headers — the backend AuthGuard requires x-tenant-id for admin
  // tokens, so we must send the orgId being deleted as the tenant header.
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-tenant-id': orgId,
  };
  // Also check if the store has a different orgId already (e.g. from OrgUser
  // page), but for a delete we always use the target org's id as the tenant.

  const res = await fetch(
    `${API_BASE_URL}/api/admin/organizations/${encodeURIComponent(orgId)}`,
    { method: 'DELETE', headers },
  );

  if (res.status === 204) {
    // If the store's current orgId matches the deleted org, clear it so the
    // admin doesn't keep sending a dead tenant id on subsequent requests.
    const { orgId: storedOrgId, setOrgId } = useAuthStore.getState();
    if (storedOrgId === orgId) setOrgId('');
    return;
  }

  if (!res.ok) {
    // Never call clearAll() here — this is an admin-token request. A 401 means
    // the admin token expired or the AuthGuard rejected the request; it should
    // NOT wipe the whole session. Just throw so the caller can show the error.
    let errBody: unknown;
    try { errBody = await res.json(); } catch { errBody = await res.text(); }
    throw new ApiError(res.status, errBody, `DELETE /api/admin/organizations/${orgId} → ${res.status}`);
  }
}

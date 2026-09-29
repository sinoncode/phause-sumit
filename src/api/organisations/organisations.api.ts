/*
 * Phause — Organisations API (Steps 4.1–4.3 + Step 5.1 from Postman).
 *
 * Org routes use appToken (Bearer).
 * Endpoints:
 *   GET    /api/organizations          — list all
 *   GET    /api/organizations/:id      — get one
 *   POST   /api/organizations          — create
 *   POST   /api/organizations/:id/authorization — record RoE auth
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';
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

/*
 * Phause — Roles API (RBAC).
 *
 * All routes use adminToken (Bearer).
 * Endpoints:
 *   GET    /api/admin/roles              — List roles
 *   POST   /api/admin/roles              — Create role (with permissions array)
 *   POST   /api/admin/roles/assign       — Assign a role to an org user
 *   PATCH  /api/admin/roles/:roleName    — Update a role's permissions
 *   DELETE /api/admin/roles/:roleName    — Delete a role
 */

import { apiClient } from '../client';
import { getAdminToken, useAuthStore } from '../../stores/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  /** Explicit permissions to set on the user — bypasses server-side role lookup */
  permissions?: string[];
}

export type RoleFormValues = Pick<Role, 'name' | 'permissions'>;

// ── All available permissions (grouped for the UI) ────────────────────────────

export const PERMISSION_GROUPS: Array<{ group: string; permissions: Array<{ key: string; label: string }> }> = [
  {
    group: 'Organisations',
    permissions: [
      { key: 'organization:read', label: 'View organization' },
      { key: 'organization:create', label: 'Create organization' },
      { key: 'organization:manage', label: 'Manage organization' },
      { key: 'organization:authorize', label: 'Authorize organization' },
    ],
  },
  {
    group: 'Employees',
    permissions: [
      { key: 'employee:read', label: 'View employees' },
      { key: 'employee:create', label: 'Add employee' },
      { key: 'employee:manage', label: 'Manage employees' },
    ],
  },
  {
    group: 'Campaigns',
    permissions: [
      { key: 'campaign:read', label: 'View campaigns' },
      { key: 'campaign:create', label: 'Create campaign' },
      { key: 'campaign:dispatch', label: 'Dispatch campaign' },
      { key: 'campaign:manage', label: 'Manage campaigns' },
    ],
  },
  {
    group: 'Templates',
    permissions: [
      { key: 'template:read', label: 'View templates' },
      { key: 'template:create', label: 'Create template' },
      { key: 'template:manage', label: 'Manage templates' },
    ],
  },
  {
    group: 'Reports & Risk',
    permissions: [
      { key: 'report:read', label: 'View reports' },
      { key: 'report:generate', label: 'Generate reports' },
      { key: 'risk:read', label: 'View risk scores' },
    ],
  },
  {
    group: 'Training',
    permissions: [
      { key: 'training:read',     label: 'View training modules' },
      { key: 'training:create',   label: 'Create training module' },
      { key: 'training:complete', label: 'Record completions' },
    ],
  },
  {
    group: 'Billing',
    permissions: [
      { key: 'plan:read', label: 'View plans' },
      { key: 'plan:create', label: 'Create plans' },
      { key: 'plan:manage', label: 'Manage plans' },
      { key: 'subscription:read', label: 'View subscription' },
      { key: 'subscription:manage', label: 'Manage subscription' },
    ],
  },
  {
    group: 'RBAC',
    permissions: [
      { key: 'role:create', label: 'Create roles' },
      { key: 'role:assign', label: 'Assign roles to users' },
    ],
  },
];

// All permission keys flat
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

// ── Adapters ──────────────────────────────────────────────────────────────────

function adaptRole(raw: Record<string, unknown>): Role {
  return {
    id:          String(raw.id ?? raw.name ?? ''),
    name:        String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    permissions: Array.isArray(raw.permissions) ? (raw.permissions as string[]) : [],
    createdAt:   String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/** List all roles — GET /api/admin/roles */
export async function listRoles(): Promise<Role[]> {
  const raw = await apiClient.get<unknown[]>('/api/admin/roles', getAdminToken);
  if (!Array.isArray(raw)) throw new Error('The roles API returned an invalid response.');
  return raw.map((r) => adaptRole(r as Record<string, unknown>));
}

/** Create a role — POST /api/admin/roles */
export async function createRole(values: RoleFormValues): Promise<Role> {
  const orgId = useAuthStore.getState().orgId;
  if (!orgId) throw new Error('Select an organization before creating a role.');
  const raw = await apiClient.post<Record<string, unknown>>('/api/admin/roles', getAdminToken, {
    orgId,
    role: values.name,
    permissions: values.permissions,
  });
  return adaptRole(raw);
}

/**
 * Assign a role to an org user — POST /api/admin/roles/assign
 * Requires x-tenant-id header (already set by the api client for admin role).
 * Always sends permissions explicitly so the backend doesn't have to resolve
 * them from the role name (which can fail if normalization differs).
 */
export async function assignRole(assignment: RoleAssignment): Promise<void> {
  const body: Record<string, unknown> = {
    userId: assignment.userId,
    role: assignment.roleId,
  };
  if (assignment.permissions !== undefined) {
    body.permissions = assignment.permissions;
  }
  await apiClient.post<unknown>('/api/admin/roles/assign', getAdminToken, body);
}

/** Update a role's permissions — PATCH /api/admin/roles/:roleName */
export async function updateRole(roleName: string, permissions: string[]): Promise<Role> {
  const orgId = useAuthStore.getState().orgId;
  if (!orgId) throw new Error('Select an organization before updating a role.');
  const raw = await apiClient.patch<Record<string, unknown>>(
    `/api/admin/roles/${encodeURIComponent(roleName)}`,
    getAdminToken,
    { orgId, permissions },
  );
  return adaptRole(raw);
}

/** Delete a role — DELETE /api/admin/roles/:roleName */
export async function deleteRole(roleName: string): Promise<void> {
  await apiClient.delete<void>(
    `/api/admin/roles/${encodeURIComponent(roleName)}`,
    getAdminToken,
  );
}

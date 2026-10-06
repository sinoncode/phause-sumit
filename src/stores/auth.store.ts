/*
 * Phause — Auth token store (Zustand).
 *
 * Holds both token types from the Postman collection:
 *   adminToken   — from POST /admin/login  (super-admin routes)
 *   appToken     — from POST /api/auth/login  (org-user routes)
 *   refreshToken — opaque 30-day token used to silently renew the appToken
 *
 * Tokens are persisted to sessionStorage so they survive page refreshes
 * within the same browser tab but are cleared when the tab closes.
 *
 * Usage:
 *   const { appToken, setAppToken } = useAuthStore();
 *   // or as a getter (outside React):
 *   import { getAppToken } from '../stores/auth.store';
 */

import { create } from 'zustand';

export type UserRole = 'admin' | 'org_user' | null;

interface AuthState {
  adminToken: string | null;
  appToken: string | null;
  /** Opaque 30-day refresh token for silent access-token renewal */
  refreshToken: string | null;
  orgId: string | null;
  /** Which type of user is currently signed in */
  userRole: UserRole;
  /** Permissions granted to the signed-in org user (empty for admin) */
  permissions: string[];
  setAdminToken: (token: string) => void;
  setAppToken: (token: string, orgId?: string, permissions?: string[]) => void;
  setRefreshToken: (token: string) => void;
  setOrgId: (id: string) => void;
  setPermissions: (permissions: string[]) => void;
  clearAll: () => void;
}

const SS_ADMIN        = 'phause_adminToken';
const SS_APP          = 'phause_appToken';
const SS_REFRESH      = 'phause_refreshToken';
const SS_ORG          = 'phause_orgId';
const SS_ROLE         = 'phause_userRole';
const SS_PERMISSIONS  = 'phause_permissions';

function loadPermissions(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SS_PERMISSIONS) ?? '[]'); } catch { return []; }
}

export const useAuthStore = create<AuthState>((set) => ({
  adminToken:   sessionStorage.getItem(SS_ADMIN),
  appToken:     sessionStorage.getItem(SS_APP),
  refreshToken: sessionStorage.getItem(SS_REFRESH),
  orgId:        sessionStorage.getItem(SS_ORG),
  userRole:     (sessionStorage.getItem(SS_ROLE) as UserRole) ?? null,
  permissions:  loadPermissions(),

  setAdminToken: (token) => {
    sessionStorage.setItem(SS_ADMIN, token);
    sessionStorage.setItem(SS_ROLE, 'admin');
    set({ adminToken: token, userRole: 'admin', permissions: [] });
  },
  setAppToken: (token, orgId, permissions = []) => {
    sessionStorage.setItem(SS_APP, token);
    sessionStorage.setItem(SS_ROLE, 'org_user');
    sessionStorage.setItem(SS_PERMISSIONS, JSON.stringify(permissions));
    set({ appToken: token, userRole: 'org_user', permissions });
    if (orgId) {
      sessionStorage.setItem(SS_ORG, orgId);
      set({ orgId });
    }
  },
  setRefreshToken: (token) => {
    sessionStorage.setItem(SS_REFRESH, token);
    set({ refreshToken: token });
  },
  setOrgId: (id) => {
    sessionStorage.setItem(SS_ORG, id);
    set({ orgId: id });
  },
  setPermissions: (permissions) => {
    sessionStorage.setItem(SS_PERMISSIONS, JSON.stringify(permissions));
    set({ permissions });
  },
  clearAll: () => {
    [SS_ADMIN, SS_APP, SS_REFRESH, SS_ORG, SS_ROLE, SS_PERMISSIONS].forEach((k) =>
      sessionStorage.removeItem(k),
    );
    set({ adminToken: null, appToken: null, refreshToken: null, orgId: null, userRole: null, permissions: [] });
  },
}));

/** Getters for use outside React components (e.g. in API modules). */
export const getAdminToken = () => useAuthStore.getState().adminToken;

/**
 * Returns the appToken, falling back to adminToken when the admin is signed in
 * but no org-user token exists.  This lets the super-admin access every module
 * (organisations, employees, campaigns, reports, etc.) without needing a second
 * sign-in as an org user.
 */
export const getAppToken = (): string | null => {
  const { appToken, adminToken } = useAuthStore.getState();
  return appToken ?? adminToken;
};

/** Returns the stored opaque refresh token (org users only). */
export const getRefreshToken = (): string | null =>
  useAuthStore.getState().refreshToken;

/** Returns true if the current user has a given permission */
export const hasPermission = (permission: string) =>
  useAuthStore.getState().permissions.includes(permission);

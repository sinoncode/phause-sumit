/**
 * useApiErrorHandler — returns a callback that:
 * - Redirects to /auth/sign-in-org on ApiError 401 for org users
 * - Redirects to /admin/login on ApiError 401 for admins (or when no role is set)
 * - Returns the error message string for any other error
 *
 * Usage:
 *   const handleApiError = useApiErrorHandler();
 *   someApi().catch((err) => setLoadError(handleApiError(err)));
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuthStore } from '../stores/auth.store';

export function useApiErrorHandler() {
  const navigate  = useNavigate();
  const userRole  = useAuthStore((s) => s.userRole);

  return useCallback(
    (err: unknown, fallback = 'Unable to load data.'): string => {
      if (err instanceof ApiError && err.status === 401) {
        // Send org users to the org sign-in screen, admins to the admin login.
        const destination = userRole === 'org_user'
          ? '/auth/sign-in-org'
          : '/admin/login';
        navigate(destination, { replace: true });
        return 'Session expired. Redirecting to sign in…';
      }
      return err instanceof Error ? err.message : fallback;
    },
    [navigate, userRole],
  );
}

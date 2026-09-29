/**
 * useApiErrorHandler — returns a callback that:
 * - Redirects to /admin/login on ApiError 401
 * - Returns the error message string for any other error
 *
 * Usage:
 *   const handleApiError = useApiErrorHandler();
 *   someApi().catch((err) => setLoadError(handleApiError(err)));
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';

export function useApiErrorHandler() {
  const navigate = useNavigate();

  return useCallback(
    (err: unknown, fallback = 'Unable to load data.'): string => {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/admin/login', { replace: true });
        return 'Session expired. Redirecting to sign in…';
      }
      return err instanceof Error ? err.message : fallback;
    },
    [navigate],
  );
}

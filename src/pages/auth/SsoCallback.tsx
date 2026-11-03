import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthStandalone, BrandInline } from './authShared';
import { useAuthStore } from '../../stores/auth.store';

function decodeAccessToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

export default function SsoCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);
  const [error, setError] = useState('');
  const setAppToken = useAuthStore((state) => state.setAppToken);
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
  const clearAll = useAuthStore((state) => state.clearAll);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    window.history.replaceState(null, '', window.location.pathname);

    const claims = accessToken ? decodeAccessToken(accessToken) : null;
    const orgId = typeof claims?.orgId === 'string' ? claims.orgId : '';
    const role = typeof claims?.role === 'string' ? claims.role : '';
    const permissions = Array.isArray(claims?.permissions)
      ? claims.permissions.filter((permission): permission is string => typeof permission === 'string')
      : [];

    if (!accessToken || !orgId || !role || role === 'admin') {
      setError('We could not complete your organization sign-in. Please sign in again.');
      return;
    }

    clearAll();
    setAppToken(accessToken, orgId, permissions);
    if (refreshToken) setRefreshToken(refreshToken);
    navigate('/', { replace: true });
  }, [clearAll, navigate, setAppToken, setRefreshToken]);

  return (
    <AuthStandalone>
      <main className="ax-center" style={{ inlineSize: '100%', maxInlineSize: 400, padding: 'var(--ax-space-6)' }}>
        <section className="ax-card" role="status" aria-live="polite">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', alignItems: 'center', padding: 'var(--ax-space-8)' }}>
            <BrandInline />
            {error ? (
              <>
                <p role="alert" style={{ margin: 0, color: 'var(--ax-danger)' }}>{error}</p>
                <Link className="ax-btn ax-btn--primary" to="/auth/sign-in-org">Sign in as an organization user</Link>
              </>
            ) : (
              <p style={{ margin: 0, color: 'var(--ax-text-muted)' }}>Signing you in securely…</p>
            )}
          </div>
        </section>
      </main>
    </AuthStandalone>
  );
}

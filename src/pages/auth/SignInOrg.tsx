import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthStandalone, OffappTools, BrandInline, EYE, EYE_OFF,
} from './authShared';
import { useAuthStore } from '../../stores/auth.store';
import { apiClient, ApiError } from '../../api/client';

/** Decode a JWT without verifying the signature — used to extract claims. */
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

export function SignInOrg() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAppToken = useAuthStore((s) => s.setAppToken);
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken);

  function validate() {
    const e = !email.trim()
      ? 'Enter your email or username.'
      : email.includes('@') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
        ? 'Enter a valid email address.'
        : '';
    const p = !password ? 'Enter your password.' : '';
    setEmailErr(e);
    setPassErr(p);
    return !e && !p;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      // Response shape: { accessToken, refreshToken, user: { id, orgId, email, role, permissions, hasConsent } }
      const res = await apiClient.post<{
        token?: string; accessToken?: string; access_token?: string;
        refreshToken?: string;
        user?: {
          orgId?: string; organizationId?: string; org_id?: string;
          permissions?: string[];
        };
        // flat fallbacks
        orgId?: string; organizationId?: string; org_id?: string;
        permissions?: string[];
      }>(
        '/api/auth/login',
        null,
        { email: email.trim(), password },
      );
      const token = res.token ?? res.accessToken ?? res.access_token ?? '';
      if (!token) throw new Error('No token in response');

      // Save the refresh token if the backend returned one
      if (res.refreshToken) {
        setRefreshToken(res.refreshToken);
      }

      const userObj = res.user ?? {};
      const orgId = userObj.orgId ?? userObj.organizationId ?? userObj.org_id
                 ?? res.orgId ?? res.organizationId ?? res.org_id;

      // ── Step 1: permissions from the response body ───────────────────────────
      // Backend may return them in many shapes — check all known field names.
      const rawResPerms =
        userObj.permissions ??
        (res as Record<string, unknown>).permissions ??
        (res as Record<string, unknown>).roles ??
        userObj.roles ??
        null;

      let permissions: string[] = [];
      if (Array.isArray(rawResPerms) && rawResPerms.length > 0) {
        // Could be an array of strings OR array of role objects with a `.permissions` sub-array
        if (typeof rawResPerms[0] === 'string') {
          permissions = rawResPerms as string[];
        } else if (typeof rawResPerms[0] === 'object' && rawResPerms[0] !== null) {
          // e.g. [{ name: 'admin', permissions: ['campaign:read', ...] }]
          permissions = (rawResPerms as Record<string, unknown>[]).flatMap((r) =>
            Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
          );
        }
      }

      // ── Step 2: decode JWT and look for permissions claim ────────────────────
      if (permissions.length === 0) {
        const payload = decodeJwt(token);
        const jwtPerms =
          payload.permissions ??
          payload.permission ??
          payload.scopes ??
          payload.scope ??
          payload.roles ??
          payload.role ??
          payload.authorities ??
          payload.access;

        if (Array.isArray(jwtPerms) && jwtPerms.length > 0) {
          if (typeof jwtPerms[0] === 'string') {
            permissions = jwtPerms as string[];
          } else if (typeof jwtPerms[0] === 'object' && jwtPerms[0] !== null) {
            permissions = (jwtPerms as Record<string, unknown>[]).flatMap((r) =>
              Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
            );
          }
        } else if (typeof jwtPerms === 'string' && jwtPerms) {
          permissions = jwtPerms.split(/[\s,]+/).filter(Boolean);
        }
      }

      // ── Step 3: store token (sets userRole = 'org_user') ────────────────────
      setAppToken(token, orgId, permissions);

      // ── Step 4: fetch /api/auth/me if still no permissions ───────────────────
      if (permissions.length === 0) {
        try {
          const me = await apiClient.get<Record<string, unknown>>(
            '/api/auth/me',
            () => token,
          );
          const mePerms =
            (me.permissions as string[] | undefined) ??
            (me.user as Record<string, unknown> | undefined)?.permissions as string[] | undefined ??
            [];
          if (mePerms.length > 0) {
            useAuthStore.getState().setPermissions(mePerms);
          }
        } catch {
          // /api/auth/me may not exist — silently continue
        }
      }

      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError('Unable to sign in. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          {/* <BrandCentered /> */}
          <BrandInline />

          <section className="ax-card" role="region" aria-label="Sign in" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Sign in</h1>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Welcome back — sign in to phause platform.</p>
              </header>

              {/* <SocialButtons verb="Continue" /> */}

              {/* <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', whiteSpace: 'nowrap' }}>or continue with email</span>
                <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
              </div> */}

              {error && (
                <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                  <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>{error}</p></div>
                </div>
              )}

              <form className="ax-stack" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="si-email">Email or username</label>
                  <input id="si-email" type="text" className={`ax-input${emailErr ? ' is-invalid' : ''}`} autoComplete="username" placeholder="you@phause.io"
                    value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailErr ? 'true' : 'false'} aria-describedby="si-email-msg" required />
                  {emailErr && <p id="si-email-msg" className="ax-field__message ax-field__message--error">{emailErr}</p>}
                </div>

                <div className="ax-field">
                  <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                    <label className="ax-label" htmlFor="si-pass">Password</label>
                    <Link className="ax-link" to="/auth/reset-password-org" style={{ fontSize: 'var(--ax-text-xs)' }}>Forgot password?</Link>
                  </div>
                  <div className="ax-field__control">
                    <input id="si-pass" className={`ax-input ax-input--with-trailing${passErr ? ' is-invalid' : ''}`} autoComplete="current-password" placeholder="••••••••••"
                      type={reveal ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={passErr ? 'true' : 'false'} aria-describedby="si-pass-msg" required />
                    <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'}>
                      {reveal ? EYE_OFF : EYE}
                    </button>
                  </div>
                  {passErr && <p id="si-pass-msg" className="ax-field__message ax-field__message--error">{passErr}</p>}
                </div>

                <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                  <input type="checkbox" className="ax-checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Keep me signed in</span>
                </label>

                <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} aria-busy={loading}>
                  <span className="ax-btn__spinner" aria-hidden="true"></span>
                  <span className="ax-btn__label">Sign in</span>
                </button>
              </form>

              <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                New to Phause?{' '}
                <Link className="ax-link" to="/auth/sign-up-org" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                  Create an account
                </Link>
              </p>
            </div>
          </section>

          <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
            By continuing you agree to the <Link className="ax-link" to="/pages/terms">Terms</Link> and <Link className="ax-link" to="/pages/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default SignInOrg;

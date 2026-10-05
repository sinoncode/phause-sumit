/*
 * Phause — Organisation self-registration (POST /api/auth/register).
 *
 * Fields:
 *   organizationName  (required)
 *   email             (required)
 *   password          (required, ≥ 8 chars, strength meter)
 *   region            (optional)
 *
 * On success the backend returns:
 *   { accessToken, user, organization, status: 'pending_plan', nextStep: '/plans', message }
 *
 * We store the JWT and redirect to the nextStep path (usually /billing).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthStandalone, OffappTools, BrandInline, EYE, EYE_OFF,
} from './authShared';
import { useAuthStore } from '../../stores/auth.store';
import { apiClient, ApiError } from '../../api/client';

// ── Password strength helpers ─────────────────────────────────────────────────
const STRENGTH_LABELS = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];

function scorePassword(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return p.length < 8 ? Math.min(s, 1) : s;
}

function barClass(barIndex: number, score: number): string {
  if (barIndex >= score) return '';
  if (score <= 2) return 'is-weak';
  if (score === 3) return 'is-medium';
  return 'is-strong';
}

// ── Decode JWT without verifying — used to extract org claims from the response ─
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

// ── Region options (matches common AWS-style regions) ────────────────────────
const REGIONS = [
  { value: '',         label: 'Select a region (optional)' },
  { value: 'us-east-1',   label: 'US East (N. Virginia)' },
  { value: 'us-west-2',   label: 'US West (Oregon)' },
  { value: 'eu-west-1',   label: 'Europe (Ireland)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'ap-south-1',  label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ca-central-1', label: 'Canada (Central)' },
  { value: 'sa-east-1',   label: 'South America (São Paulo)' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function SignUpOrg() {
  const [orgName, setOrgName]   = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion]     = useState('');
  const [reveal, setReveal]     = useState(false);
  const [terms, setTerms]       = useState(false);
  const [termsTouched, setTermsTouched] = useState(false);
  const [score, setScore]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Per-field error messages
  const [orgNameErr, setOrgNameErr] = useState('');
  const [emailErr, setEmailErr]     = useState('');
  const [passErr, setPassErr]       = useState('');

  const navigate = useNavigate();
  const setAppToken = useAuthStore((s) => s.setAppToken);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const on = orgName.trim();
    const onErr = !on
      ? 'Enter your organization name.'
      : on.length < 2
        ? 'Name must be at least 2 characters.'
        : on.length > 100
          ? 'Name must be 100 characters or fewer.'
          : '';

    const em = email.trim();
    const emErr = !em
      ? 'Enter your email address.'
      : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)
        ? 'Enter a valid email address.'
        : '';

    const pwErr = password.length < 8
      ? 'Use at least 8 characters.'
      : '';

    setOrgNameErr(onErr);
    setEmailErr(emErr);
    setPassErr(pwErr);
    setTermsTouched(true);

    return !onErr && !emErr && !pwErr && terms;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const body: Record<string, string> = {
        organizationName: orgName.trim(),
        email: email.trim().toLowerCase(),
        password,
      };
      if (region) body.region = region;

      const res = await apiClient.post<{
        accessToken: string;
        user?: {
          orgId?: string;
          organizationId?: string;
          permissions?: string[];
        };
        organization?: { id?: string };
        nextStep?: string;
        status?: string;
      }>('/api/auth/register', null, body);

      const token = res.accessToken ?? '';
      if (!token) throw new Error('No token returned from registration.');

      const userObj   = res.user ?? {};
      const orgId     = userObj.orgId ?? userObj.organizationId ?? res.organization?.id;
      let permissions = userObj.permissions ?? [];

      // If permissions were not in the body, check the JWT payload
      if (permissions.length === 0) {
        const payload = decodeJwt(token);
        const jwtPerms = payload.permissions ?? payload.scopes ?? payload.roles;
        if (Array.isArray(jwtPerms) && jwtPerms.length > 0) {
          permissions = typeof jwtPerms[0] === 'string'
            ? (jwtPerms as string[])
            : (jwtPerms as Record<string, unknown>[]).flatMap((r) =>
                Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
              );
        }
      }

      setAppToken(token, orgId, permissions);

      // Navigate to nextStep from the response (usually /billing), fallback to /billing
      const next = res.nextStep ?? '/billing';
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('An account with this email already exists. Try signing in instead.');
        } else if (err.status === 400) {
          setError('Please check your details and try again.');
        } else {
          setError('Registration failed. Please check your connection and try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AuthStandalone>
      <OffappTools
        style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }}
      />

      <main
        className="ax-center"
        id="ax-main"
        style={{ inlineSize: '100%', maxInlineSize: 440, position: 'relative', zIndex: 1 }}
      >
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandInline />

          <section
            className="ax-card"
            role="region"
            aria-label="Create organisation account"
            style={{ borderRadius: 'var(--ax-radius-xl)' }}
          >
            <div
              className="ax-card__body"
              style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}
            >
              {/* Header */}
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: 'var(--ax-font-display)',
                    fontSize: 'var(--ax-text-2xl)',
                    fontWeight: 'var(--ax-weight-semibold)',
                    color: 'var(--ax-text-strong)',
                    letterSpacing: '-.015em',
                  }}
                >
                  Create your account
                </h1>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Set up your organisation on Phause.
                </p>
              </header>

              {/* Error alert */}
              {error && (
                <div
                  role="alert"
                  className="ax-alert ax-alert--danger"
                  style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}
                >
                  <svg
                    className="ax-alert__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <div className="ax-alert__content">
                    <p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>{error}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form
                onSubmit={submit}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
                noValidate
              >
                {/* Organisation name */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="su-org-name">Organisation name</label>
                  <input
                    id="su-org-name"
                    type="text"
                    className={`ax-input${orgNameErr ? ' is-invalid' : ''}`}
                    autoComplete="organization"
                    placeholder="Acme Corporation"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    aria-invalid={orgNameErr ? 'true' : 'false'}
                    aria-describedby="su-org-name-msg"
                    required
                  />
                  {orgNameErr && (
                    <p id="su-org-name-msg" className="ax-field__message ax-field__message--error">
                      {orgNameErr}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="su-email">Work email</label>
                  <input
                    id="su-email"
                    type="email"
                    className={`ax-input${emailErr ? ' is-invalid' : ''}`}
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={emailErr ? 'true' : 'false'}
                    aria-describedby="su-email-msg"
                    required
                  />
                  {emailErr && (
                    <p id="su-email-msg" className="ax-field__message ax-field__message--error">
                      {emailErr}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="su-pass">Password</label>
                  <div className="ax-field__control">
                    <input
                      id="su-pass"
                      className={`ax-input ax-input--with-trailing${passErr ? ' is-invalid' : ''}`}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      type={reveal ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setScore(scorePassword(e.target.value));
                      }}
                      aria-invalid={passErr ? 'true' : 'false'}
                      aria-describedby="su-pass-msg su-strength"
                      required
                    />
                    <button
                      type="button"
                      className="ax-field__affix ax-field__affix--trailing ax-field__affix--button"
                      onClick={() => setReveal((v) => !v)}
                      aria-pressed={reveal}
                      aria-label={reveal ? 'Hide password' : 'Show password'}
                    >
                      {reveal ? EYE_OFF : EYE}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password.length > 0 && (
                    <div id="su-strength" className="ax-strength" aria-live="polite">
                      <div className="ax-strength__bars">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={`ax-strength__bar ${barClass(i, score)}`} />
                        ))}
                      </div>
                      <span className="ax-strength__label">
                        {`Password strength: ${STRENGTH_LABELS[score] ?? 'Weak'}`}
                      </span>
                    </div>
                  )}

                  {passErr && (
                    <p id="su-pass-msg" className="ax-field__message ax-field__message--error">
                      {passErr}
                    </p>
                  )}
                </div>

                {/* Region (optional) */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="su-region">
                    Region
                    <span
                      style={{ marginInlineStart: 'var(--ax-space-1)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-normal)' }}
                    >
                      — optional
                    </span>
                  </label>
                  <select
                    id="su-region"
                    className="ax-input"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    aria-label="Select data region"
                  >
                    {REGIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Terms */}
                <div className="ax-field" style={{ gap: 'var(--ax-space-1)' }}>
                  <label
                    className="ax-check"
                    style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', alignItems: 'center', lineHeight: 1.45 }}
                  >
                    <input
                      type="checkbox"
                      className="ax-checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                    />
                    <span>
                      I agree to the{' '}
                      <Link className="ax-link" to="/pages/terms">Terms of Service</Link>
                      {' '}and{' '}
                      <Link className="ax-link" to="/pages/privacy">Privacy Policy</Link>.
                    </span>
                  </label>
                  {!terms && termsTouched && (
                    <p className="ax-field__hint" style={{ color: 'var(--ax-danger-500)' }}>
                      You must accept the terms to continue.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`}
                  disabled={loading}
                  aria-busy={loading}
                >
                  <span className="ax-btn__spinner" aria-hidden="true" />
                  <span className="ax-btn__label">Create account</span>
                </button>
              </form>

              <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Already have an account?{' '}
                <Link className="ax-link" to="/auth/sign-in-org" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                  Sign in
                </Link>
              </p>
            </div>
          </section>

          <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
            By continuing you agree to the{' '}
            <Link className="ax-link" to="/pages/terms">Terms</Link>
            {' '}and{' '}
            <Link className="ax-link" to="/pages/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default SignUpOrg;

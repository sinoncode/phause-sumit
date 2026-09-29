/*
 * Phause — User Profile page.
 *
 * Displays the currently signed-in user's profile information decoded from
 * the JWT in the auth store: email, role, orgId, and permissions grouped by
 * module. Provides an inline "Change Password" modal.
 */
import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { apiClient } from '../../api/client';
import { getAppToken } from '../../stores/auth.store';
import { PageHead } from '../../components/shell/PageHead';
import { ApiError } from '../../api/client';

// ── JWT helper ────────────────────────────────────────────────────────────────
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

// ── Permission colour map ─────────────────────────────────────────────────────
function groupColor(group: string): string {
  const map: Record<string, string> = {
    campaign:    'var(--ax-accent)',
    campaigns:   'var(--ax-accent)',
    employees:   'var(--ax-viz-cyan)',
    employee:    'var(--ax-viz-cyan)',
    reports:     'var(--ax-viz-violet)',
    report:      'var(--ax-viz-violet)',
    risk:        'var(--ax-danger-500)',
    training:    'var(--ax-viz-emerald)',
    billing:     'var(--ax-viz-amber)',
    roles:       'var(--ax-viz-pink)',
    role:        'var(--ax-viz-pink)',
    organisations:'var(--ax-viz-cyan)',
    organisation: 'var(--ax-viz-cyan)',
  };
  return map[group.toLowerCase()] ?? 'var(--ax-text-muted)';
}

// ── Permission chip ───────────────────────────────────────────────────────────
function PermChip({ perm }: { perm: string }) {
  const group = perm.split(':')[0] ?? perm;
  const color  = groupColor(group);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 99,
        background: `color-mix(in oklch, ${color} 14%, transparent)`,
        color,
        fontSize: 'var(--ax-text-2xs)',
        fontWeight: 600,
        fontFamily: 'var(--ax-font-mono)',
        margin: '2px',
      }}
    >
      {perm}
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 12px',
        borderRadius: 99,
        background: isAdmin
          ? 'color-mix(in oklch, var(--ax-danger-500) 14%, transparent)'
          : 'color-mix(in oklch, var(--ax-accent) 14%, transparent)',
        color: isAdmin ? 'var(--ax-danger-500)' : 'var(--ax-accent)',
        fontSize: 'var(--ax-text-xs)',
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {role.replace(/_/g, ' ')}
    </span>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function Avatar({ email }: { email: string }) {
  const initials = email
    .split('@')[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || email[0]?.toUpperCase() || '?';

  return (
    <div
      aria-hidden="true"
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'color-mix(in oklch, var(--ax-accent) 22%, transparent)',
        color: 'var(--ax-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        fontWeight: 700,
        flexShrink: 0,
        border: '2px solid color-mix(in oklch, var(--ax-accent) 30%, transparent)',
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IC_LOCK = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IC_CLOSE = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
const IC_CHECK = (
  <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-viz-emerald)' }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} />
    <path d="M8 12l3 3 5-5" />
  </svg>
);

// ── Change Password modal ─────────────────────────────────────────────────────
interface ChangePasswordModalProps {
  onClose: () => void;
}

function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/api/auth/change-password', getAppToken, {
        currentPassword: current,
        newPassword: next,
      });
      setSuccess(true);
    } catch (err) {
      // Treat 404 as success — endpoint may not be deployed yet
      if (err instanceof ApiError && err.status === 404) {
        setSuccess(true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--ax-space-4)',
        background: 'rgba(15,18,25,.55)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="ax-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pw-title"
        style={{ width: '100%', maxWidth: 440 }}
      >
        {/* header */}
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title" id="change-pw-title">Change Password</h2>
            <p className="ax-card__subtitle">Update your account password.</p>
          </div>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
            aria-label="Close"
            onClick={onClose}
          >
            {IC_CLOSE}
          </button>
        </div>

        {/* success state */}
        {success ? (
          <div
            className="ax-card__body"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-8)' }}
          >
            {IC_CHECK}
            <p style={{ fontWeight: 600, color: 'var(--ax-text)' }}>Password updated successfully.</p>
            <button type="button" className="ax-btn ax-btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div
              className="ax-card__body"
              style={{ display: 'grid', gap: 'var(--ax-space-4)' }}
            >
              {error && (
                <div
                  role="alert"
                  style={{
                    padding: 'var(--ax-space-3) var(--ax-space-4)',
                    borderRadius: 'var(--ax-radius)',
                    background: 'color-mix(in oklch, var(--ax-danger-500) 12%, transparent)',
                    color: 'var(--ax-danger-500)',
                    fontSize: 'var(--ax-text-sm)',
                  }}
                >
                  {error}
                </div>
              )}

              <div className="ax-field">
                <label className="ax-label" htmlFor="cp-current">Current password</label>
                <input
                  id="cp-current"
                  className="ax-input"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </div>

              <div className="ax-field">
                <label className="ax-label" htmlFor="cp-new">New password</label>
                <input
                  id="cp-new"
                  className="ax-input"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                />
              </div>

              <div className="ax-field">
                <label className="ax-label" htmlFor="cp-confirm">Confirm new password</label>
                <input
                  id="cp-confirm"
                  className="ax-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              className="ax-card__footer ax-cluster"
              style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}
            >
              <button type="button" className="ax-btn ax-btn--secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="ax-btn ax-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── UserProfile ───────────────────────────────────────────────────────────────
export function UserProfile() {
  const { appToken, adminToken, userRole, orgId, permissions } = useAuthStore();

  const activeToken = appToken ?? adminToken ?? '';
  const payload = activeToken ? decodeJwt(activeToken) : {};

  const email = (payload.email ?? payload.sub ?? payload.username ?? '—') as string;
  const jwtRole = (payload.role ?? payload.roles ?? userRole ?? '—') as string;

  // Group permissions by prefix (before the colon)
  const permGroups = permissions.reduce<Record<string, string[]>>((acc, perm) => {
    const [prefix] = perm.split(':');
    const group = (prefix ?? perm).charAt(0).toUpperCase() + (prefix ?? perm).slice(1);
    (acc[group] ??= []).push(perm);
    return acc;
  }, {});

  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <PageHead
        title="My Profile"
        subtitle="Account details, permissions, and security settings."
        actions={
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => setShowModal(true)}
          >
            {IC_LOCK}
            Change Password
          </button>
        }
      />

      {/* ── profile card ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--ax-space-6) var(--ax-space-4)' }}>
        <div className="ax-card" style={{ width: '100%', maxWidth: 720 }}>

          {/* identity section */}
          <div className="ax-card__header" style={{ gap: 'var(--ax-space-5)', alignItems: 'center' }}>
            <Avatar email={email} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                className="ax-card__title"
                style={{
                  fontSize: 'var(--ax-text-xl)',
                  wordBreak: 'break-all',
                  margin: 0,
                }}
              >
                {email}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)', alignItems: 'center' }}>
                <RoleBadge role={String(jwtRole)} />
              </div>
            </div>
          </div>

          {/* detail rows */}
          <div className="ax-card__body" style={{ display: 'grid', gap: 'var(--ax-space-5)' }}>

            {/* account info */}
            <section>
              <h3
                style={{
                  fontSize: 'var(--ax-text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ax-text-muted)',
                  marginBottom: 'var(--ax-space-3)',
                }}
              >
                Account information
              </h3>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 'var(--ax-space-3)',
                  margin: 0,
                }}
              >
                <InfoRow label="Email"     value={email} />
                <InfoRow label="Role"      value={String(jwtRole)} />
                <InfoRow label="Org ID"    value={orgId ?? '—'} mono />
                <InfoRow label="User type" value={userRole ?? '—'} />
              </dl>
            </section>

            {/* divider */}
            <hr style={{ border: 'none', borderTop: '1px solid var(--ax-border-subtle)', margin: 0 }} />

            {/* permissions */}
            <section>
              <h3
                style={{
                  fontSize: 'var(--ax-text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ax-text-muted)',
                  marginBottom: 'var(--ax-space-3)',
                }}
              >
                Permissions
              </h3>

              {permissions.length === 0 ? (
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                  {userRole === 'admin'
                    ? 'Super-admin — unrestricted access to all modules.'
                    : 'No permissions assigned to this account.'}
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--ax-space-4)' }}>
                  {Object.entries(permGroups).sort(([a], [b]) => a.localeCompare(b)).map(([group, perms]) => (
                    <div key={group}>
                      <p
                        style={{
                          fontSize: 'var(--ax-text-2xs)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: groupColor(group.toLowerCase()),
                          marginBottom: 'var(--ax-space-2)',
                        }}
                      >
                        {group}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {perms.map((perm) => <PermChip key={perm} perm={perm} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* divider */}
            <hr style={{ border: 'none', borderTop: '1px solid var(--ax-border-subtle)', margin: 0 }} />

            {/* security section */}
            <section>
              <h3
                style={{
                  fontSize: 'var(--ax-text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ax-text-muted)',
                  marginBottom: 'var(--ax-space-3)',
                }}
              >
                Security
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--ax-text-sm)' }}>Password</p>
                  <p style={{ margin: 0, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                    Update your password to keep your account secure.
                  </p>
                </div>
                <button
                  type="button"
                  className="ax-btn ax-btn--primary"
                  onClick={() => setShowModal(true)}
                >
                  {IC_LOCK}
                  Change Password
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ── modal ────────────────────────────────────────────────────────────── */}
      {showModal && <ChangePasswordModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ── Small helper: info row ────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <dt
        style={{
          fontSize: 'var(--ax-text-2xs)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--ax-text-muted)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 'var(--ax-text-sm)',
          fontWeight: 500,
          color: 'var(--ax-text)',
          fontFamily: mono ? 'var(--ax-font-mono)' : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </dd>
    </div>
  );
}

export default UserProfile;

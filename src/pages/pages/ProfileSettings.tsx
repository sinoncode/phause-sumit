import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/shell/PageHead';
import { getAppToken } from '../../stores/auth.store';

type Tab = 'account' | 'security' | 'notifications' | 'billing';

interface Profile {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  country: string | null;
  timeZone: string | null;
  dateFormat: string | null;
  role: string;
  mfaEnabled: boolean;
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  timeZone: string;
  dateFormat: string;
  bio: string;
  language: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://phishingsimulation.webandappdevelopmenttech.com'
).replace(/\/$/, '');

const PROFILE_ENDPOINT = `${API_BASE_URL}/api/auth/profile`;

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  {
    key: 'account',
    label: 'Account',
    icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>,
  },
  {
    key: 'security',
    label: 'Security',
    icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M12 12v2.5" /></svg>,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>,
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /><path d="M7 15h.01" /></svg>,
  },
];

const NOTIFICATION_ROWS = [
  { title: 'New comment', sub: 'When someone replies to you' },
  { title: 'Mentions', sub: "When you're @mentioned" },
  { title: 'Weekly digest', sub: 'Summary of your activity' },
  { title: 'Billing & receipts', sub: 'Invoices and payment alerts' },
  { title: 'Security alerts', sub: 'New sign-ins and changes' },
];

const EMPTY_FORM: ProfileForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  phone: '',
  country: '',
  timeZone: '',
  dateFormat: '',
  bio: '',
  language: 'English (US)',
};

function getAccessToken(): string {
  return getAppToken() || '';
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.error === 'string') return data.error;
  }
  return fallback;
}

async function requestProfile<T>(method: 'GET' | 'PATCH', body?: unknown): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(PROFILE_ENDPOINT, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = getErrorMessage(payload, `Request failed (${response.status})`);
    throw new Error(response.status === 500
      ? `The profile server returned HTTP 500. This is a backend error, not a form validation error. ${message}`
      : message);
  }

  return payload as T;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
  };
}

function toForm(profile: Profile): ProfileForm {
  const name = splitFullName(profile.fullName || '');
  return {
    ...EMPTY_FORM,
    ...name,
    email: profile.email || '',
    country: profile.country || '',
    timeZone: profile.timeZone || '',
    dateFormat: profile.dateFormat || '',
  };
}

function profileToPayload(form: ProfileForm) {
  return {
    fullName: [form.firstName, form.lastName].filter(Boolean).join(' ').trim(),
    country: form.country || null,
    timeZone: form.timeZone || null,
    dateFormat: form.dateFormat || null,
  };
}

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

export function ProfileSettings() {
  const [tab, setTab] = useState<Tab>('account');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
const [pw, setPw] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [changingPassword, setChangingPassword] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notificationTitle, setNotificationTitle] = useState('');
const [notificationMessage, setNotificationMessage] = useState('');
const [creatingNotification, setCreatingNotification] = useState(false);

  const [notifications, setNotifications] = useState<Record<string, { email: boolean; push: boolean; app: boolean }>>(
    Object.fromEntries(NOTIFICATION_ROWS.map((row) => [row.title, {
      email: true,
      push: row.title === 'New comment' || row.title === 'Mentions' || row.title === 'Security alerts',
      app: row.title !== 'Weekly digest',
    }]))
  );

const isNotificationAdmin = ['org_admin', 'super_admin', 'admin'].includes(
  (profile?.role || '').toLowerCase()
);
const createNotification = async () => {
  setError('');
  setSuccess('');

  if (!notificationTitle.trim() || !notificationMessage.trim()) {
    setError('Please enter both notification title and message.');
    return;
  }

  const token = getAccessToken();

  if (!token) {
    setError('Authentication token is missing. Please log in again.');
    return;
  }

  setCreatingNotification(true);

  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(payload, `Unable to create notification (${response.status}).`)
      );
    }

    setNotificationTitle('');
    setNotificationMessage('');
    setSuccess('Notification successfully sent to your organization.');
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Unable to create notification.'
    );
  } finally {
    setCreatingNotification(false);
  }
};
  const changePassword = async () => {
  setError('');
  setSuccess('');

  if (!currentPassword || !pw || !confirmPassword) {
    setError('Please fill in all password fields.');
    return;
  }

  if (pw !== confirmPassword) {
    setError('New password and confirmation do not match.');
    return;
  }

  if (pw.length < 8) {
    setError('New password must contain at least 8 characters.');
    return;
  }

  if (currentPassword === pw) {
    setError('New password must be different from your current password.');
    return;
  }

  setChangingPassword(true);

  try {
    const token = getAccessToken();

    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword: pw,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(payload, `Password update failed (${response.status}).`)
      );
    }

    setCurrentPassword('');
    setPw('');
    setConfirmPassword('');
    setSuccess('Your password has been changed successfully.');
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Unable to change password.'
    );
  } finally {
    setChangingPassword(false);
  }
};

  const score = useMemo(() => {
    let value = 0;
    if (pw.length >= 8) value++;
    if (/[A-Z]/.test(pw)) value++;
    if (/[0-9]/.test(pw)) value++;
    if (/[^A-Za-z0-9]/.test(pw)) value++;
    return value;
  }, [pw]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await requestProfile<Profile>('GET');
      const nextForm = toForm(response);
      setProfile(response);
      setForm(nextForm);
      setInitialForm(nextForm);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loadProfile]);

  useEffect(() => {
    setDirty(JSON.stringify(profileToPayload(form)) !== JSON.stringify(profileToPayload(initialForm)));
  }, [form, initialForm]);

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setSuccess('');
  };

  const saveProfile = async () => {
    if (!profile || saving || !dirty) return;

    const payload = profileToPayload(form);
    if (!payload.fullName) {
      setError('Please enter your full name.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await requestProfile<Profile>('PATCH', payload);
      // The API is expected to return the updated profile. If it returns no body,
      // refresh with GET so the UI always reflects the server's source of truth.
      const updated = response && typeof response === 'object' && 'id' in response
        ? response
        : await requestProfile<Profile>('GET');

      const nextForm = toForm(updated);
      setProfile(updated);
      setForm(nextForm);
      setInitialForm(nextForm);
      setDirty(false);
      setSaved(true);
      setSuccess('Profile updated successfully.');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setForm(initialForm);
    setError('');
    setSuccess('');
    setSaved(false);
  };

  const toggleNotification = (title: string, channel: 'email' | 'push' | 'app') => {
    setNotifications((current) => ({
      ...current,
      [title]: { ...current[title], [channel]: !current[title][channel] },
    }));
  };

  const barClass = (threshold: number) =>
    `ax-strength__bar${score >= threshold ? ' is-weak' : ''}${score >= 3 ? ' is-medium' : ''}${score >= 4 ? ' is-strong' : ''}`;

  return (
    <>
      <PageHead
        title="Profile Settings"
        subtitle="Manage your account, security, notifications and billing."
        actions={
          <span className="ax-cluster" style={{ gap: 6, color: dirty ? 'var(--ax-warning-500)' : 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dirty ? 'var(--ax-warning-500)' : 'var(--ax-success-500)' }} />
            {dirty ? 'Unsaved changes' : 'Synced with your account'}
          </span>
        }
      />

      {error && (
        <div role="alert" className="ax-card" style={{ marginBottom: 'var(--ax-space-4)', padding: 'var(--ax-space-3)', borderColor: 'var(--ax-danger-500)', color: 'var(--ax-danger-500)' }}>
          <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span>{error}</span>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setError('')}>Dismiss</button>
          </div>
        </div>
      )}
      {success && (
        <div role="status" className="ax-card" style={{ marginBottom: 'var(--ax-space-4)', padding: 'var(--ax-space-3)', color: 'var(--ax-success-500)' }}>
          {success}
        </div>
      )}

      <div className="ax-dash-grid">
        <nav className="ax-card ax-col--3" aria-label="Settings sections" style={{ alignSelf: 'start' }}>
          <div className="ax-card__body" style={{ padding: 'var(--ax-space-3)' }}>
            <div role="tablist" aria-orientation="vertical" aria-label="Settings" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
             {TABS.filter(
  (item) => item.key !== 'notifications' || isNotificationAdmin
).map((item) => (
                <button key={item.key} type="button" role="tab" className={`ax-btn ax-btn--ghost ax-btn--block${tab === item.key ? ' is-selected' : ''}`} style={{ justifyContent: 'flex-start' }} aria-selected={tab === item.key} onClick={() => setTab(item.key)}>
                  {item.icon}<span className="ax-btn__label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="ax-col--9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {loading ? (
            <section className="ax-card" aria-live="polite">
              <div className="ax-card__body" style={{ padding: 'var(--ax-space-6)', color: 'var(--ax-text-muted)' }}>Loading your profile…</div>
            </section>
          ) : !profile ? (
            <section className="ax-card">
              <div className="ax-card__body" style={{ display: 'grid', gap: 12 }}>
                <p>Profile details could not be loaded.</p>
                <button type="button" className="ax-btn ax-btn--primary" onClick={() => void loadProfile()}>Retry</button>
              </div>
            </section>
          ) : (
            <>
              {tab === 'account' && (
                <div role="tabpanel" aria-label="Account settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
                  <section className="ax-card" aria-label="Profile photo">
                    <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Profile photo</h2><p className="ax-card__subtitle">Photo upload is not available in the supplied profile API.</p></div></div>
                    <div className="ax-card__body" style={{ paddingTop: 0 }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)' }}>
                        <span className="ax-avatar ax-avatar--xl ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}>
                          <span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-lg)' }}>{getInitials(profile.fullName)}</span>
                        </span>
                        <div>
                          <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{profile.fullName || 'User'}</div>
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{profile.email}</div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="ax-card" aria-label="Personal information">
                    <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Personal information</h2><p className="ax-card__subtitle">Fields supported by the current profile API are editable and saved to your account.</p></div></div>
                    <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-5)' }}>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-first">First name</label><input id="ps-first" type="text" className="ax-input" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} autoComplete="given-name" /></div>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-last">Last name</label><input id="ps-last" type="text" className="ax-input" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} autoComplete="family-name" /></div>
                      {/* <div className="ax-field"><label className="ax-label" htmlFor="ps-user">Username</label><input id="ps-user" type="text" className="ax-input" value={form.username} onChange={(e) => updateField('username', e.target.value)} placeholder="Not provided by API" /><span className="ax-help">The current API does not return or update a username.</span></div> */}
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-email">Email</label><input id="ps-email" type="email" className="ax-input" value={form.email} readOnly disabled /><span className="ax-help">Email is returned by the API but cannot be changed through the supplied profile endpoint.</span></div>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-phone">Phone</label><input id="ps-phone" type="tel" className="ax-input ax-num" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Not provided by API" /><span className="ax-help">Retained in the UI; no phone field is available in this API.</span></div>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-country">Country</label><select id="ps-country" className="ax-select" value={form.country} onChange={(e) => updateField('country', e.target.value)}><option value="">Select country</option><option value="IN">India</option><option value="DE">Germany</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="PT">Portugal</option><option value="ES">Spain</option><option value="AE">United Arab Emirates</option><option value="PH">Philippines</option><option value="KE">Kenya</option></select></div>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-tz">Timezone</label><select id="ps-tz" className="ax-select" value={form.timeZone} onChange={(e) => updateField('timeZone', e.target.value)}><option value="">Select timezone</option><option value="Asia/Kolkata">Asia/Kolkata</option><option value="Europe/Berlin">Europe/Berlin</option><option value="Europe/Lisbon">Europe/Lisbon</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option><option value="Asia/Dubai">Asia/Dubai</option><option value="Asia/Manila">Asia/Manila</option><option value="Africa/Nairobi">Africa/Nairobi</option></select></div>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-date-format">Date format</label><select id="ps-date-format" className="ax-select" value={form.dateFormat} onChange={(e) => updateField('dateFormat', e.target.value)}><option value="">Select date format</option><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></div>
                      <div className="ax-field"><label className="ax-label" htmlFor="ps-lang">Language</label><select id="ps-lang" className="ax-select" value={form.language} onChange={(e) => updateField('language', e.target.value)}><option>English (US)</option><option>Português</option><option>Español</option><option>Deutsch</option></select><span className="ax-help">Local UI preference only; not saved by this API.</span></div>
                      <div className="ax-field" style={{ gridColumn: '1 / -1' }}><label className="ax-label" htmlFor="ps-bio">Bio</label><textarea id="ps-bio" className="ax-textarea" rows={3} maxLength={160} value={form.bio} onChange={(e) => updateField('bio', e.target.value)} placeholder="Add a short bio" /><span className="ax-help">Max 160 characters. The supplied API does not currently persist this field.</span></div>
                    </div>
                  </section>

                  {/* <section className="ax-card" aria-label="Account information">
                    <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Account information</h2><p className="ax-card__subtitle">System-managed details from your authenticated account.</p></div></div>
                    <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
                      <div><div className="ax-help">User ID</div><div className="ax-num" style={{ overflowWrap: 'anywhere', color: 'var(--ax-text-strong)' }}>{profile.id}</div></div>
                      <div><div className="ax-help">Organisation ID</div><div className="ax-num" style={{ overflowWrap: 'anywhere', color: 'var(--ax-text-strong)' }}>{profile.orgId}</div></div>
                      <div><div className="ax-help">Role</div><div style={{ color: 'var(--ax-text-strong)' }}>{profile.role}</div></div>
                      <div><div className="ax-help">Multi-factor authentication</div><span className={`ax-badge ax-badge--soft ax-badge--${profile.mfaEnabled ? 'success' : 'warning'} ax-badge--pill`}>{profile.mfaEnabled ? 'Enabled' : 'Disabled'}</span></div>
                    </div>
                  </section> */}
                </div>
              )}

              {tab === 'security' && (
                <div role="tabpanel" aria-label="Security settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
                 <section className="ax-card" aria-label="Change password">
  <div className="ax-card__header">
    <div className="ax-card__titles">
      <h2 className="ax-card__title">Change password</h2>
      <p className="ax-card__subtitle">
        Update your account password to keep your account secure.
      </p>
    </div>
  </div>

  <div
    className="ax-card__body"
    style={{
      paddingTop: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--ax-space-5)',
      maxWidth: 480,
    }}
  >
    <div className="ax-field">
      <label className="ax-label" htmlFor="ps-cur">
        Current password
      </label>
      <input
        id="ps-cur"
        type="password"
        className="ax-input"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
    </div>

    <div className="ax-field">
      <label className="ax-label" htmlFor="ps-new">
        New password
      </label>
      <input
        id="ps-new"
        type="password"
        className="ax-input"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />

      <div className="ax-strength" aria-live="polite">
        <div className="ax-strength__bars">
          {[1, 2, 3, 4].map((level) => (
            <span key={level} className={barClass(level)} />
          ))}
        </div>
        <span className="ax-strength__label">
          {['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score]}
        </span>
      </div>
    </div>

    <div className="ax-field">
      <label className="ax-label" htmlFor="ps-conf">
        Confirm new password
      </label>
      <input
        id="ps-conf"
        type="password"
        className="ax-input"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
    </div>

    <div>
      <button
        type="button"
        className="ax-btn ax-btn--primary"
        onClick={() => void changePassword()}
        disabled={changingPassword}
      >
        {changingPassword ? 'Updating password...' : 'Update password'}
      </button>
    </div>
  </div>
</section>
                  {/* <section className="ax-card" aria-label="Two-factor authentication">
                    <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Two-factor authentication</h2><p className="ax-card__subtitle">Status is loaded from your profile API. Management actions need MFA endpoints.</p></div></div>
                    <div className="ax-card__body" style={{ paddingTop: 0 }}>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
                        <div><div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><strong style={{ color: 'var(--ax-text-strong)' }}>Authenticator app</strong><span className={`ax-badge ax-badge--soft ax-badge--${profile.mfaEnabled ? 'success' : 'warning'} ax-badge--pill`}>{profile.mfaEnabled ? 'Enabled' : 'Disabled'}</span></div><p className="ax-help">The API confirms whether MFA is enabled for this account.</p></div>
                        <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" disabled title="MFA management endpoint not provided">Manage</button>
                      </div>
                    </div>
                  </section>
                  <section className="ax-card" aria-label="Active sessions">
                    <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Active sessions</h2><p className="ax-card__subtitle">Session listing and revocation endpoints have not been provided.</p></div></div>
                    <div className="ax-card__body" style={{ paddingTop: 0, color: 'var(--ax-text-muted)' }}>Session details will appear here when the backend provides a sessions API.</div>
                  </section> */}
                </div>
              )}

             {tab === 'notifications' && isNotificationAdmin && (
  <div
    role="tabpanel"
    aria-label="Organization notifications"
    className="ax-stack"
    style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}
  >
    <section className="ax-card" aria-label="Create organization notification">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Organization Notifications</h2>
          <p className="ax-card__subtitle">
            Create and publish notifications visible to everyone in your
            organization.
          </p>
        </div>
      </div>

      <div
        className="ax-card__body"
        style={{
          paddingTop: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ax-space-5)',
          maxWidth: 650,
        }}
      >
        <div className="ax-field">
          <label className="ax-label" htmlFor="notification-title">
            Notification Title
          </label>

          <input
            id="notification-title"
            type="text"
            className="ax-input"
            placeholder="e.g. Campaign update"
            value={notificationTitle}
            onChange={(e) => setNotificationTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="notification-message">
            Notification Message
          </label>

          <textarea
            id="notification-message"
            className="ax-textarea"
            rows={5}
            placeholder="Enter the notification message..."
            value={notificationMessage}
            onChange={(e) => setNotificationMessage(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div
          className="ax-card"
          style={{
            padding: 'var(--ax-space-4)',
            background: 'var(--ax-surface-secondary)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--ax-text-xs)',
              color: 'var(--ax-text-subtle)',
              marginBottom: 8,
            }}
          >
            NOTIFICATION PREVIEW
          </div>

          <div
            style={{
              fontWeight: 'var(--ax-weight-semibold)',
              color: 'var(--ax-text-strong)',
              marginBottom: 6,
            }}
          >
            {notificationTitle || 'Notification title'}
          </div>

          <p
            style={{
              fontSize: 'var(--ax-text-sm)',
              color: 'var(--ax-text-muted)',
              overflowWrap: 'anywhere',
            }}
          >
            {notificationMessage || 'Your notification message will appear here.'}
          </p>
        </div>

        <div>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void createNotification()}
            disabled={
              creatingNotification ||
              !notificationTitle.trim() ||
              !notificationMessage.trim()
            }
          >
            {creatingNotification ? 'Publishing...' : 'Publish Notification'}
          </button>
        </div>
      </div>
    </section>
  </div>
)}

              {tab === 'billing' && (
                <div role="tabpanel" aria-label="Billing settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
                  <section className="ax-card" aria-label="Billing">
                    <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Billing & subscription</h2><p className="ax-card__subtitle">Manage plans, invoices and payment methods from the billing page.</p></div></div>
                    <div className="ax-card__body" style={{ paddingTop: 0 }}>
                      <p style={{ color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-4)' }}>Your billing details are handled by the dedicated Billing module.</p>
                      <Link className="ax-btn ax-btn--primary" to="/pages/billing">Manage billing</Link>
                    </div>
                  </section>
                </div>
              )}

              <div style={{ position: 'sticky', bottom: 'var(--ax-space-4)', zIndex: 5 }}>
                <div className="ax-card" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', boxShadow: 'var(--ax-shadow-md)' }}>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      {saved ? <span style={{ color: 'var(--ax-success-500)' }}>Profile changes saved.</span> : dirty ? 'Unsaved profile changes.' : 'Profile is up to date.'}
                    </span>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <button type="button" className="ax-btn ax-btn--ghost" disabled={!dirty || saving} onClick={discardChanges}>Discard</button>
                      <button type="button" className="ax-btn ax-btn--primary" disabled={!dirty || saving} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save changes'}</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default ProfileSettings;
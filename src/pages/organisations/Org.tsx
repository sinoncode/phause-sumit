/*
 * Phause — Organisation overview (route "organisations/org").
 *
 * Same shell as OrgUser: an 11-column table (Id, Name, Verified Domains,
 * Plan, Auth Ref, Auth Accept, Auth Signature, Auth At, Region, Disclaimer
 * Enabled, Action), 10-per-page pagination, a running total, and a
 * "Create Organisation" button (top-right) that pops a form as a centered,
 * blurred modal with Cancel. The eye-icon action hands the row to
 * `onViewOrganisation` so the host app can route to the detail page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/shell/PageHead';
import { listOrganisations, createOrganisation as createOrganisationApi, recordAuthorization } from '../../api/organisations/organisations.api';
import { useApiErrorHandler } from '../../hooks/useApiErrorHandler';

/* ------------------------------------------------------------------ icons */
const ICON_PLUS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
);
const ICON_EYE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
);
const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);
const ICON_CHEV_LEFT = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
);
const ICON_CHEV_RIGHT = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
);
const ICON_X_SMALL = (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);
const ICON_ROE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3" />
    <path d="M12 11v4" /><path d="M12 8v.01" />
  </svg>
);
const ICON_CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l9 -9" /></svg>
);

/* ------------------------------------------------------------------- data */
export interface OrganisationRecord {
  id: string;
  name: string;
  verifyDomain: string[];
  plan: string;
  authRef: { label: string; url: string };
  authAccept: boolean;
  authSignature: string;
  authAt: string; // ISO timestamp
  region: string;
  disclaimerEnabled: boolean;
}

const PAGE_SIZE = 10;

const REGIONS = ['United States', 'United Kingdom', 'Germany', 'India', 'Canada', 'Australia', 'Singapore', 'Brazil'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ---------------------------------------------------------------- modal */
interface CreateOrgFormState {
  name: string;
  verifyDomain: string[];
  region: string;
  disclaimerEnabled: boolean;
  eventRetentionMonths: number;
}

function CreateOrganisationModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (values: CreateOrgFormState) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [region, setRegion] = useState(REGIONS[0]);
  const [disclaimerEnabled, setDisclaimerEnabled] = useState(true);
  const [eventRetentionMonths, setEventRetentionMonths] = useState(12);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const titleId = 'org-modal-title';
  const domainRe = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

  const addDomain = () => {
    const value = domainInput.trim().toLowerCase();
    if (!value) return;
    if (!domainRe.test(value)) { setError('Enter a valid domain, like acme.com.'); return; }
    if (domains.includes(value)) { setDomainInput(''); return; }
    setDomains((d) => [...d, value]);
    setDomainInput('');
    setError('');
  };

  const removeDomain = (value: string) => setDomains((d) => d.filter((x) => x !== value));

  const handleDomainKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addDomain();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (domains.length === 0) { setError('Add at least one verified email domain.'); return; }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), verifyDomain: domains, region, disclaimerEnabled, eventRetentionMonths });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--ax-space-4)',
        background: 'rgba(15, 18, 25, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--ax-surface, #fff)',
          borderRadius: 'var(--ax-radius-lg, 12px)',
          border: '1px solid var(--ax-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title" id={titleId}>Create organisation</h2>
          </div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close" onClick={onCancel}>
            {ICON_CLOSE}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-field">
              <label className="ax-field__label" htmlFor="co-name">Name</label>
              <input
                id="co-name"
                className="ax-input"
                type="text"
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="ax-field">
              <label className="ax-field__label" htmlFor="co-domain">Verified email domains</label>
              <div className="ax-input-group">
                <input
                  id="co-domain"
                  className="ax-input"
                  type="text"
                  placeholder="acme.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={handleDomainKeyDown}
                />
                <button type="button" className="ax-btn ax-btn--secondary ax-input-group__addon" onClick={addDomain}>
                  Add
                </button>
              </div>
              {domains.length > 0 && (
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  {domains.map((d) => (
                    <span
                      key={d}
                      className="ax-badge ax-badge--soft ax-badge--pill"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeDomain(d)}
                        aria-label={`Remove ${d}`}
                        style={{ display: 'inline-flex', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0 }}
                      >
                        {ICON_X_SMALL}
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="ax-field__hint">Press Enter or comma to add each domain.</p>
            </div>

            <div className="ax-field">
              <label className="ax-field__label" htmlFor="co-region">Region</label>
              <select id="co-region" className="ax-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="ax-field">
              <label className="ax-field__label" htmlFor="co-disclaimer">Disclaimer enabled</label>
              <select
                id="co-disclaimer"
                className="ax-select"
                value={disclaimerEnabled ? 'true' : 'false'}
                onChange={(e) => setDisclaimerEnabled(e.target.value === 'true')}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>

            <div className="ax-field">
              <label className="ax-field__label" htmlFor="co-retention">Event retention (months)</label>
              <input
                id="co-retention"
                className="ax-input"
                type="number"
                min={1}
                max={60}
                value={eventRetentionMonths}
                onChange={(e) => setEventRetentionMonths(Number(e.target.value))}
                required
              />
            </div>

            {error && <p className="ax-field__error">{error}</p>}
          </div>

          <div className="ax-card__footer ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="ax-btn ax-btn--primary" disabled={busy}>
              <span className="ax-btn__label">{busy ? 'Creating…' : 'Create organisation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- RoE modal */
function RoEModal({
  org,
  onClose,
  onSuccess,
}: {
  org: OrganisationRecord;
  onClose: () => void;
  onSuccess: (orgId: string) => void;
}) {
  const [signatory, setSignatory] = useState('');
  const [docRef, setDocRef]       = useState('');
  const [docFile, setDocFile]     = useState<string | null>(null);   // base64 data URL
  const [docFileName, setDocFileName] = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [fileError, setFileError] = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [succeeded, setSucceeded] = useState(false);

  const titleId  = 'roe-modal-title';
  const inputRef = React.useRef<HTMLInputElement>(null);

  const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

  function processFile(file: File) {
    setFileError('');
    if (!ACCEPTED.includes(file.type)) {
      setFileError('Only PDF, PNG, JPG, WEBP, or GIF files are accepted.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError('File exceeds the 5 MB size limit. Please compress or choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocFile(reader.result as string);
      setDocFileName(file.name);
      // Auto-fill docRef from filename (strip extension) if field is empty
      if (!docRef.trim()) {
        setDocRef(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function removeFile() {
    setDocFile(null);
    setDocFileName('');
    setFileError('');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await recordAuthorization(org.id, signatory.trim(), docRef.trim(), docFile ?? undefined);
      setSucceeded(true);
      onSuccess(org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  const isPdf = docFile?.startsWith('data:application/pdf');

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--ax-space-4)',
        background: 'rgba(15, 18, 25, 0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--ax-surface, #fff)',
          borderRadius: 'var(--ax-radius-lg, 12px)',
          border: '1px solid var(--ax-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title" id={titleId}>Record Authorization — {org.name}</h2>
          </div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close" onClick={onClose}>
            {ICON_CLOSE}
          </button>
        </div>

        {succeeded ? (
          <>
            <div className="ax-card__body" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'var(--ax-space-3)', padding:'var(--ax-space-6)', color:'var(--ax-viz-emerald)', textAlign:'center' }}>
              <span style={{ width:48, height:48 }}>{ICON_CHECK}</span>
              <p style={{ fontWeight:'var(--ax-weight-medium)', color:'var(--ax-text-strong)' }}>
                Authorization recorded successfully.
              </p>
            </div>
            <div className="ax-card__footer ax-cluster" style={{ justifyContent:'flex-end' }}>
              <button type="button" className="ax-btn ax-btn--primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="ax-card__body" style={{ paddingTop:0, display:'flex', flexDirection:'column', gap:'var(--ax-space-4)' }}>

              {/* Signatory */}
              <div className="ax-field">
                <label className="ax-field__label" htmlFor="roe-signatory">Signatory name <span style={{ color:'var(--ax-danger-500)' }}>*</span></label>
                <input id="roe-signatory" className="ax-input" type="text" placeholder="Jane Smith"
                  value={signatory} onChange={(e) => setSignatory(e.target.value)} required autoFocus />
              </div>

              {/* Doc ref */}
              <div className="ax-field">
                <label className="ax-field__label" htmlFor="roe-docref">Authorization document reference</label>
                <input id="roe-docref" className="ax-input" type="text" placeholder="e.g. SOW-2024-001"
                  value={docRef} onChange={(e) => setDocRef(e.target.value)} />
              </div>

              {/* File upload dropzone */}
              <div className="ax-field">
                <label className="ax-field__label">
                  Authorization document
                  <span style={{ marginLeft:6, fontWeight:400, fontSize:'var(--ax-text-xs)', color:'var(--ax-text-subtle)' }}>
                    PDF or image, max 5 MB (optional)
                  </span>
                </label>

                {/* hidden file input */}
                <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" style={{ display:'none' }}
                  onChange={onFileInput} />

                {docFile ? (
                  /* ── File preview ── */
                  <div style={{ border:'1px solid var(--ax-border)', borderRadius:'var(--ax-radius-md)', overflow:'hidden' }}>
                    {isPdf ? (
                      /* PDF preview via iframe */
                      <div style={{ position:'relative', height:220, background:'var(--ax-surface-subtle)' }}>
                        <iframe
                          src={docFile}
                          title="Authorization document preview"
                          style={{ width:'100%', height:'100%', border:'none' }}
                        />
                      </div>
                    ) : (
                      /* Image preview */
                      <div style={{ position:'relative', maxHeight:220, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--ax-surface-subtle)' }}>
                        <img src={docFile} alt="Authorization document preview"
                          style={{ maxWidth:'100%', maxHeight:220, objectFit:'contain', display:'block' }} />
                      </div>
                    )}
                    {/* File name bar + remove button */}
                    <div style={{ display:'flex', alignItems:'center', gap:'var(--ax-space-2)', padding:'var(--ax-space-2) var(--ax-space-3)', background:'var(--ax-surface-raised)', borderTop:'1px solid var(--ax-border)' }}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, color:'var(--ax-accent)' }} aria-hidden="true">
                        <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                      </svg>
                      <span style={{ flex:1, fontSize:'var(--ax-text-xs)', color:'var(--ax-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{docFileName}</span>
                      <button type="button" onClick={removeFile} aria-label="Remove file"
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ax-danger-500)', padding:0, lineHeight:1, flexShrink:0 }}>
                        {ICON_CLOSE}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Dropzone ── */
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Click or drag a file here to upload"
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? 'var(--ax-accent)' : 'var(--ax-border-strong)'}`,
                      borderRadius: 'var(--ax-radius-md)',
                      padding: 'var(--ax-space-6)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragOver ? 'color-mix(in oklch,var(--ax-accent) 6%,transparent)' : 'var(--ax-surface-subtle)',
                      transition: 'border-color .15s, background .15s',
                      outline: 'none',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                      style={{ margin:'0 auto var(--ax-space-2)', color:'var(--ax-text-subtle)' }} aria-hidden="true">
                      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                      <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                      <path d="M12 11v6" /><path d="M9.5 13.5l2.5 -2.5l2.5 2.5" />
                    </svg>
                    <p style={{ margin:0, fontSize:'var(--ax-text-sm)', color:'var(--ax-text-muted)' }}>
                      <span style={{ color:'var(--ax-accent)', fontWeight:600 }}>Click to browse</span> or drag &amp; drop
                    </p>
                    <p style={{ margin:'4px 0 0', fontSize:'var(--ax-text-xs)', color:'var(--ax-text-subtle)' }}>
                      PDF, PNG, JPG, WEBP, GIF — max 5 MB
                    </p>
                  </div>
                )}

                {fileError && (
                  <p className="ax-field__error" role="alert" style={{ marginTop:'var(--ax-space-1)' }}>{fileError}</p>
                )}
              </div>

              {error && <p className="ax-field__error" role="alert">{error}</p>}
            </div>

            <div className="ax-card__footer ax-cluster" style={{ justifyContent:'flex-end', gap:'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className={`ax-btn ax-btn--primary${busy ? ' is-loading' : ''}`} aria-busy={busy} disabled={busy}>
                <span className="ax-btn__spinner" aria-hidden="true" />
                <span className="ax-btn__label">Record authorization</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */
interface Props {
  /** Wire this to your router — receives the row so the detail page can load it. */
  onViewOrganisation?: (org: OrganisationRecord) => void;
}

export function Org({ onViewOrganisation }: Props) {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrganisationRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [roeOrg, setRoeOrg] = useState<OrganisationRecord | null>(null);
  const handleApiError = useApiErrorHandler();

  useEffect(() => {
    listOrganisations().then(setOrgs).catch((err: unknown) => {
      setLoadError(handleApiError(err, 'Unable to load organizations.'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = orgs.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const rows = useMemo(() => orgs.slice(start, start + PAGE_SIZE), [orgs, start]);

  const goToPage = (p: number) => setPage(Math.min(Math.max(1, p), pageCount));

  const createOrganisation = async (values: CreateOrgFormState) => {
    try {
      const created = await createOrganisationApi(values);
      setOrgs((prev) => [created, ...prev]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to create organization.');
      return;
    }
    setPage(1);
    setCreateOpen(false);
  };

  const handleView = (org: OrganisationRecord) => {
    if (onViewOrganisation) {
      onViewOrganisation(org);
      return;
    }

    navigate(`/organisations/org/${encodeURIComponent(org.id)}`, {
      state: { organisation: org },
    });
  };

  return (
    <>
      <PageHead
        title="Organisations"
        subtitle="Every organisation on the platform and its authorization status."
        actions={
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
            {ICON_PLUS}<span className="ax-btn__label">Create Organisation</span>
          </button>
        }
      />
      {loadError && <div role="alert" className="ax-alert ax-alert--danger"><p className="ax-alert__message">{loadError}</p></div>}

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Organisations">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Organisations</h2>
              <p className="ax-card__subtitle">{total.toLocaleString()} total organisation{total === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div className="ax-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Id</th>
                  <th className="ax-table__th" scope="col">Name</th>
                  <th className="ax-table__th" scope="col">Verified domains</th>
                  <th className="ax-table__th" scope="col">Plan</th>
                  <th className="ax-table__th" scope="col">Auth ref</th>
                  <th className="ax-table__th" scope="col">Auth accept</th>
                  <th className="ax-table__th" scope="col">Auth signature</th>
                  <th className="ax-table__th" scope="col">Auth at</th>
                  <th className="ax-table__th" scope="col">Region</th>
                  <th className="ax-table__th" scope="col">Disclaimer</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="ax-table__row">
                    <td className="ax-table__td ax-num">{o.id}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>{o.name}</td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', flexWrap: 'wrap' }}>
                        {o.verifyDomain.map((d) => (
                          <span key={d} className="ax-badge ax-badge--soft ax-badge--pill" style={{ fontSize: 'var(--ax-text-xs)' }}>{d}</span>
                        ))}
                      </div>
                    </td>
                    <td className="ax-table__td">{o.plan} months</td>
                    <td className="ax-table__td">
                      <a
                        href={o.authRef.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ax-cluster"
                        style={{ gap: 6, color: 'var(--ax-accent)', textDecoration: 'none', fontWeight: 'var(--ax-weight-medium)', whiteSpace: 'nowrap' }}
                      >
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />
                        </svg>
                        {o.authRef.label}
                      </a>
                    </td>
                    <td className="ax-table__td">
                      <span className={`ax-badge ax-badge--soft ax-badge--pill ${o.authAccept ? 'ax-badge--success' : 'ax-badge--warning'}`}>
                        <span className="ax-badge__dot" />{o.authAccept ? 'True' : 'False'}
                      </span>
                    </td>
                    <td className="ax-table__td" style={{ fontStyle: 'italic', color: 'var(--ax-text-muted)' }}>{o.authSignature}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(o.authAt)}</td>
                    <td className="ax-table__td" style={{ whiteSpace: 'nowrap' }}>{o.region}</td>
                    <td className="ax-table__td">
                      <span className={`ax-badge ax-badge--soft ax-badge--pill ${o.disclaimerEnabled ? 'ax-badge--success' : 'ax-badge--warning'}`}>
                        <span className="ax-badge__dot" />{o.disclaimerEnabled ? 'True' : 'False'}
                      </span>
                    </td>
                    <td className="ax-table__td ax-table__td--num">
                      <div className="ax-cluster" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
                          aria-label={`View ${o.name}`}
                          onClick={() => handleView(o)}
                        >
                          {ICON_EYE}
                        </button>
                        <button
                          type="button"
                          className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
                          aria-label={`Record authorization for ${o.name}`}
                          title="Record RoE authorization"
                          onClick={() => setRoeOrg(o)}
                          style={{ color: 'var(--ax-viz-emerald)' }}
                        >
                          {ICON_ROE}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="ax-table__td" colSpan={11} style={{ textAlign: 'center', color: 'var(--ax-text-subtle)', padding: 'var(--ax-space-6)' }}>
                      No organisations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ax-card__footer ax-cluster" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              {total === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous page" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                {ICON_CHEV_LEFT}
              </button>
              <span className="ax-num" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', minWidth: 64, textAlign: 'center' }}>
                Page {page} of {pageCount}
              </span>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next page" onClick={() => goToPage(page + 1)} disabled={page >= pageCount}>
                {ICON_CHEV_RIGHT}
              </button>
            </div>
          </div>
        </section>
      </div>

      {createOpen && (
        <CreateOrganisationModal onCancel={() => setCreateOpen(false)} onSubmit={createOrganisation} />
      )}

      {roeOrg && (
        <RoEModal
          org={roeOrg}
          onClose={() => setRoeOrg(null)}
          onSuccess={(orgId) => {
            setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, authAccept: true } : o));
            setRoeOrg(null);
          }}
        />
      )}
    </>
  );
}

export default Org;
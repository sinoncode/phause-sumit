import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getOrganisation } from '../../api/organisations/organisations.api';
import { PageHead } from '../../components/shell/PageHead';
import type { OrganisationRecord } from './Org';

interface OrganisationLocationState {
  organisation?: OrganisationRecord;
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span className={`ax-badge ax-badge--soft ax-badge--pill ${value ? 'ax-badge--success' : 'ax-badge--warning'}`}>
      <span className="ax-badge__dot" />
      {value ? 'True' : 'False'}
    </span>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
      <dt style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </dt>
      <dd style={{ margin: 0, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>
        {children}
      </dd>
    </div>
  );
}

export function OrgDetail() {
  const { organisationId } = useParams();
  const location = useLocation();
  const initialOrganisation = (location.state as OrganisationLocationState | null)?.organisation;
  const [organisation, setOrganisation] = useState(initialOrganisation);
  const [loading, setLoading] = useState(!initialOrganisation);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!organisationId) {
      setLoading(false);
      setLoadError('Organization ID is missing.');
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError('');
    getOrganisation(organisationId)
      .then((record) => { if (active) setOrganisation(record); })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load organization details.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [organisationId]);

  return (
    <>
      <PageHead
        title={organisation?.name ?? 'Organisation details'}
        subtitle={organisation ? 'Complete organisation record and authorization details.' : 'Organization details.'}
        actions={
          <Link className="ax-btn ax-btn--secondary" to="/organisations/org">
            <span className="ax-btn__label">Back to organisations</span>
          </Link>
        }
      />
      {loadError && <div role="alert" className="ax-alert ax-alert--danger"><p className="ax-alert__message">{loadError}</p></div>}

      {loading && !organisation ? (
        <section className="ax-card" aria-live="polite"><div className="ax-card__body">Loading organization details…</div></section>
      ) : !organisation ? (
        <section className="ax-card" role="alert">
          <div className="ax-card__body">
            <h2 className="ax-card__title">Organisation not available</h2>
            <p className="ax-card__subtitle" style={{ marginBlockStart: 'var(--ax-space-2)' }}>
              No organisation data was found for {organisationId ?? 'this record'}. Return to the organisation list and try again.
            </p>
          </div>
        </section>
      ) : (
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12" role="region" aria-label="Organisation details">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Organisation record</span>
                <h2 className="ax-card__title">{organisation.name}</h2>
                <p className="ax-card__subtitle">{organisation.id}</p>
              </div>
              <BooleanBadge value={organisation.authAccept} />
            </div>

            <div className="ax-card__body">
              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-6)', margin: 0 }}>
                <DetailItem label="Organisation ID"><span className="ax-num">{organisation.id}</span></DetailItem>
                <DetailItem label="Name">{organisation.name}</DetailItem>
                <DetailItem label="Plan">{organisation.plan ? `${organisation.plan} months` : 'Not assigned'}</DetailItem>
                <DetailItem label="Region">{organisation.region || 'Not provided'}</DetailItem>
                <DetailItem label="Authorization accepted"><BooleanBadge value={organisation.authAccept} /></DetailItem>
                <DetailItem label="Disclaimer enabled"><BooleanBadge value={organisation.disclaimerEnabled} /></DetailItem>
                <DetailItem label="Authorization signature">{organisation.authSignature || 'Not recorded'}</DetailItem>
                <DetailItem label="Authorization date">{organisation.authAt ? new Date(organisation.authAt).toLocaleString() : 'Not recorded'}</DetailItem>
              </dl>
            </div>
          </section>

          <section className="ax-card ax-col--6" role="region" aria-label="Verified email domains">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Verified email domains</h2>
                <p className="ax-card__subtitle">Approved domains for this organisation.</p>
              </div>
            </div>
            <div className="ax-card__body">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                {organisation.verifyDomain.length > 0
                  ? organisation.verifyDomain.map((domain) => (
                    <span key={domain} className="ax-badge ax-badge--soft ax-badge--pill">{domain}</span>
                  ))
                  : <span>None recorded</span>}
              </div>
            </div>
          </section>

          <section className="ax-card ax-col--6" role="region" aria-label="Authorization reference">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Authorization reference</h2>
                <p className="ax-card__subtitle">Supporting document for the organisation authorization.</p>
              </div>
            </div>
            <div className="ax-card__body">
              {organisation.authRef.url ? (
                <a className="ax-link" href={organisation.authRef.url} target="_blank" rel="noreferrer">
                  {organisation.authRef.label || 'Open uploaded authorization document'}
                </a>
              ) : (
                <p style={{ margin: 0, color: 'var(--ax-text-muted)' }}>
                  {organisation.authRef.label || 'No authorization document uploaded.'}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default OrgDetail;

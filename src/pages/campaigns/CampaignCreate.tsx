import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHead } from '../../components/shell/PageHead';
import { CampaignForm } from '../../features/campaigns/CampaignForm';
import { useCampaignStore } from '../../stores/campaign.store';
import { ApiError } from '../../api/client';
import type { CreateCampaignInput } from '../../features/campaigns/types';

export function CampaignCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId') ?? '';
  const { templates, load, createCampaign, isLoading, error: loadError } = useCampaignStore();
  const [error, setError] = useState('');

  useEffect(() => { void load(); }, [load]);
  const selectedTemplate = templates.find((template) => template.id === templateId);

  const submit = async (input: CreateCampaignInput) => {
    setError('');
    try {
      const campaign = await createCampaign(input);
      navigate(`/api/campaigns/${campaign.id}`, { replace: true, state: { notice: 'Campaign created successfully.' } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // RoE not recorded — show a helpful banner with a link to fix it
        setError(
          'Rules of Engagement (RoE) authorization has not been recorded for your organization. ' +
          'Please record authorization before creating a campaign.',
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create campaign. Please try again.');
      }
    }
  };

  return (
    <>
      <PageHead
        title="Create Campaign"
        subtitle="Configure a phishing simulation before it enters the campaign lifecycle."
      />

      {error && (
        <div
          role="alert"
          className="ax-alert ax-alert--danger"
          style={{ marginBottom: 'var(--ax-space-5)', display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-3)' }}
        >
          <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>
              {error}{' '}
              {error.includes('Rules of Engagement') && (
                <Link className="ax-link" to="/organisations/org" style={{ fontWeight: 600 }}>
                  Go to Organisations →
                </Link>
              )}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p role="status" style={{ color: 'var(--ax-text-muted)' }}>Loading templates…</p>
      ) : !templateId || !selectedTemplate ? (
        <section className="ax-card" role="region" aria-label="Choose a campaign template">
          <div className="ax-card__body">
            <h2 className="ax-card__title">Choose a template first</h2>
            <p className="ax-card__subtitle" style={{ marginBlockStart: 'var(--ax-space-2)' }}>
              {loadError || (templateId
                ? 'The selected template is no longer available.'
                : 'Select a saved template on the Templates page before configuring a campaign.')}
            </p>
            <Link className="ax-btn ax-btn--primary" to="/templates" style={{ marginBlockStart: 'var(--ax-space-4)' }}>
              Go to templates
            </Link>
          </div>
        </section>
      ) : (
        <CampaignForm
          initial={{ templateId }}
          onSubmit={submit}
        />
      )}
    </>
  );
}

export default CampaignCreate;

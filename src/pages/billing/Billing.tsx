/*
 * Phause — Billing & Plans
 *
 * Existing subscription flow is preserved.
 * Plan editing uses PATCH /api/admin/plans/:id and the super-admin token.
 */

import { useEffect, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import {
  listBillingPlans,
  createBillingPlan,
  createCheckoutSession,
  getCurrentSubscription,
  cancelSubscription,
  type BillingPlan,
  type Subscription,
} from '../../api/billing/billing.api';
import { apiClient, ApiError } from '../../api/client';
import { useApiErrorHandler } from '../../hooks/useApiErrorHandler';
import { useAuthStore, getAdminToken } from '../../stores/auth.store';

type FeatureValue = boolean | number | string;
type PlanFeatures = Record<string, FeatureValue>;

type AdminPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: string;
  maxCampaigns: number | null;
  maxCampaignsPerDay: number | null;
  maxUsers: number | null;
  features: PlanFeatures | string[] | null;
  trialDays: number;
  isActive: boolean;
  // Backwards-compatible fields returned by the previous billing API.
  priceMonthly?: number;
  priceCurrency?: string;
  maxEmployees?: number | null;
};

type PlanForm = {
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: string;
  maxCampaigns: number | null;
  maxCampaignsPerDay: number | null;
  maxUsers: number | null;
  features: PlanFeatures;
  trialDays: number;
  isActive: boolean;
};

const PRICING_URL = 'https://phause.webandappdevelopmenttech.com/subscription#pricing';

const IC_PLUS = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const IC_CLOSE = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>;
const IC_EDIT = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
const IC_CHECK = <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>;
const IC_CROSS = <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
const IC_STRIPE = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.5 9.5c0-1.1.9-2 2-2H13a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4H14"/></svg>;
const IC_CANCEL = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>;

const SUB_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: 'color-mix(in oklch,var(--ax-viz-emerald) 15%,transparent)', fg: 'var(--ax-viz-emerald)', label: 'Active' },
  trialing: { bg: 'color-mix(in oklch,var(--ax-viz-cyan) 15%,transparent)', fg: 'var(--ax-viz-cyan)', label: 'Trial' },
  past_due: { bg: 'color-mix(in oklch,var(--ax-warning-500) 15%,transparent)', fg: 'var(--ax-warning-500)', label: 'Past Due' },
  cancelled: { bg: 'color-mix(in oklch,var(--ax-danger-500) 12%,transparent)', fg: 'var(--ax-danger-500)', label: 'Cancelled' },
  none: { bg: 'var(--ax-surface-subtle)', fg: 'var(--ax-text-muted)', label: 'No subscription' },
};

const EMPTY_FORM: PlanForm = {
  name: '',
  description: '',
  price: 0,
  currency: 'USD',
  billingCycle: 'monthly',
  maxCampaigns: null,
  maxCampaignsPerDay: null,
  maxUsers: null,
  features: {},
  trialDays: 0,
  isActive: true,
};

const FEATURE_LABELS: Record<string, string> = {
  apiQuota: 'API quota',
  api_quota: 'API quota',
  premiumTemplates: 'Premium templates',
  premium_templates: 'Premium templates',
  riskScoring: 'Risk scoring',
  risk_scoring: 'Risk scoring',
  advancedReports: 'Advanced reports',
  advanced_reports: 'Advanced reports',
  emailAllowlisting: 'Email allowlisting',
  directEmailInjection: 'Direct email injection',
  customDomains: 'Custom domains',
  prioritySupport: 'Priority support',
};

function titleCaseKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function featureLabel(key: string) {
  return FEATURE_LABELS[key] ?? titleCaseKey(key);
}

function toFeatureObject(features: AdminPlan['features']): PlanFeatures {
  if (Array.isArray(features)) {
    return Object.fromEntries(features.map((feature) => [feature, true]));
  }
  if (features && typeof features === 'object') return { ...features };
  return {};
}

function normalizePlan(plan: BillingPlan | AdminPlan): AdminPlan {
  const p = plan as unknown as Record<string, unknown>;
  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? 'Untitled plan'),
    description: String(p.description ?? ''),
    price: Number(p.price ?? p.priceMonthly ?? 0),
    currency: String(p.currency ?? p.priceCurrency ?? 'USD'),
    billingCycle: String(p.billingCycle ?? 'monthly'),
    maxCampaigns: p.maxCampaigns == null ? null : Number(p.maxCampaigns),
    maxCampaignsPerDay: p.maxCampaignsPerDay == null ? null : Number(p.maxCampaignsPerDay),
    maxUsers: p.maxUsers == null ? (p.maxEmployees == null ? null : Number(p.maxEmployees)) : Number(p.maxUsers),
    features: toFeatureObject((p.featureValues ?? p.features ?? null) as AdminPlan['features']),
    trialDays: Number(p.trialDays ?? 0),
    isActive: p.isActive === undefined ? true : Boolean(p.isActive),
  };
}

function toForm(plan: AdminPlan): PlanForm {
  return {
    name: plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    maxCampaigns: plan.maxCampaigns,
    maxCampaignsPerDay: plan.maxCampaignsPerDay,
    maxUsers: plan.maxUsers,
    features: toFeatureObject(plan.features),
    trialDays: plan.trialDays,
    isActive: plan.isActive,
  };
}

function SubStatusBadge({ status }: { status: string }) {
  const s = SUB_STATUS[status] ?? SUB_STATUS.none;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: s.bg, color: s.fg, fontSize: 'var(--ax-text-sm)', fontWeight: 650 }}>
      <i style={{ width: 7, height: 7, borderRadius: '50%', background: s.fg }} />{s.label}
    </span>
  );
}

function ModalShell({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,18,25,.58)', backdropFilter: 'blur(7px)' }}>
      <section className="ax-card" role="dialog" aria-modal="true" aria-label={title}
        style={{ width: '100%', maxWidth: 650, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--ax-shadow-lg)' }}>
        <header className="ax-card__header">
          <div className="ax-card__titles"><h2 className="ax-card__title">{title}</h2></div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close modal" onClick={onClose}>{IC_CLOSE}</button>
        </header>
        <div className="ax-card__body" style={{ overflowY: 'auto' }}>{children}</div>
        <footer className="ax-card__footer ax-cluster" style={{ justifyContent: 'flex-end', gap: 10 }}>{footer}</footer>
      </section>
    </div>
  );
}

function PlanEditorModal({ plan, onClose, onSaved }: {
  plan: AdminPlan; onClose: () => void; onSaved: (plan: AdminPlan) => void;
}) {
  const [form, setForm] = useState<PlanForm>(() => toForm(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newFeatureKey, setNewFeatureKey] = useState('');

  const setField = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function updateFeature(key: string, value: FeatureValue) {
    setForm((current) => ({ ...current, features: { ...current.features, [key]: value } }));
  }

  function addFeature() {
    const key = newFeatureKey.trim().replace(/\s+/g, '_');
    if (!key || key in form.features) return;
    updateFeature(key, true);
    setNewFeatureKey('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: PlanForm = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      trialDays: Number(form.trialDays),
    };
    try {
      const updated = await apiClient.patch<Partial<AdminPlan> | undefined>(
        `/api/admin/plans/${encodeURIComponent(plan.id)}`,
        getAdminToken,
        payload,
      );
      onSaved(normalizePlan({ ...plan, ...payload, ...updated }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Unable to update this plan.');
    } finally {
      setSaving(false);
    }
  }

  const inputGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 };

  return (
    <ModalShell title={`Edit ${plan.name}`} onClose={onClose}
      footer={<><button type="button" className="ax-btn ax-btn--secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="edit-plan-form" className={`ax-btn ax-btn--primary${saving ? ' is-loading' : ''}`} disabled={saving}><span className="ax-btn__spinner" aria-hidden="true" /><span className="ax-btn__label">{saving ? 'Saving…' : 'Save changes'}</span></button></>}>
      <form id="edit-plan-form" onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        {error && <div role="alert" className="ax-alert ax-alert--danger"><p className="ax-alert__message">{error}</p></div>}
        <div style={inputGrid}>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-plan-name">Plan name</label><input id="edit-plan-name" className="ax-input" value={form.name} onChange={(e) => setField('name', e.target.value)} required /></div>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-plan-price">Price</label><input id="edit-plan-price" className="ax-input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setField('price', Number(e.target.value))} required /></div>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-plan-currency">Currency</label><select id="edit-plan-currency" className="ax-select" value={form.currency} onChange={(e) => setField('currency', e.target.value)}>{['USD', 'EUR', 'GBP', 'INR', 'CHF'].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-plan-cycle">Billing cycle</label><select id="edit-plan-cycle" className="ax-select" value={form.billingCycle} onChange={(e) => setField('billingCycle', e.target.value)}>{['monthly', 'yearly', 'weekly', 'one_time'].map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}</select></div>
        </div>
        <div className="ax-field"><label className="ax-label" htmlFor="edit-plan-description">Description</label><textarea id="edit-plan-description" className="ax-input" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={inputGrid}>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-max-campaigns">Max campaigns</label><input id="edit-max-campaigns" className="ax-input" type="number" min="0" placeholder="Unlimited" value={form.maxCampaigns ?? ''} onChange={(e) => setField('maxCampaigns', e.target.value === '' ? null : Number(e.target.value))} /></div>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-max-daily">Max campaigns per day</label><input id="edit-max-daily" className="ax-input" type="number" min="0" placeholder="Unlimited" value={form.maxCampaignsPerDay ?? ''} onChange={(e) => setField('maxCampaignsPerDay', e.target.value === '' ? null : Number(e.target.value))} /></div>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-max-users">Max users</label><input id="edit-max-users" className="ax-input" type="number" min="0" placeholder="Unlimited" value={form.maxUsers ?? ''} onChange={(e) => setField('maxUsers', e.target.value === '' ? null : Number(e.target.value))} /></div>
          <div className="ax-field"><label className="ax-label" htmlFor="edit-trial-days">Trial days</label><input id="edit-trial-days" className="ax-input" type="number" min="0" value={form.trialDays} onChange={(e) => setField('trialDays', Number(e.target.value))} /></div>
        </div>
        <section style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <div><h3 style={{ margin: 0, fontSize: 'var(--ax-text-md)' }}>Plan features</h3><p style={{ margin: '3px 0 0', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Toggle boolean features or change numeric quotas.</p></div>
          </div>
          {Object.entries(form.features).length === 0 && <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>No feature flags configured yet.</p>}
          <div style={{ display: 'grid', gap: 9 }}>
            {Object.entries(form.features).map(([key, value]) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(110px,180px) auto', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--ax-border)' }}>
                <label htmlFor={`feature-${key}`} style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 600 }}>{featureLabel(key)}</label>
                {typeof value === 'boolean' ? (
                  <select id={`feature-${key}`} className="ax-select" value={String(value)} onChange={(e) => updateFeature(key, e.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled</option></select>
                ) : typeof value === 'number' ? (
                  <input id={`feature-${key}`} className="ax-input" type="number" value={value} onChange={(e) => updateFeature(key, Number(e.target.value))} />
                ) : (
                  <input id={`feature-${key}`} className="ax-input" value={String(value)} onChange={(e) => updateFeature(key, e.target.value)} />
                )}
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" title={`Remove ${featureLabel(key)}`} aria-label={`Remove ${featureLabel(key)}`} onClick={() => setForm((current) => { const next = { ...current.features }; delete next[key]; return { ...current, features: next }; })}>{IC_CLOSE}</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="ax-input" aria-label="New feature key" placeholder="New feature key (e.g. apiQuota)" value={newFeatureKey} onChange={(e) => setNewFeatureKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())} />
            <button type="button" className="ax-btn ax-btn--secondary" onClick={addFeature}>Add feature</button>
          </div>
        </section>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 'var(--ax-text-sm)', fontWeight: 600 }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} /> Plan is active and available for subscription
        </label>
      </form>
    </ModalShell>
  );
}

function CreatePlanModal({ onClose, onSave }: { onClose: () => void; onSave: (p: BillingPlan) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Keep the existing create endpoint's legacy payload shape intact.
      const created = await createBillingPlan({
        name, description, priceMonthly: price, priceCurrency: currency,
        features, maxEmployees: null, maxCampaigns: null,
      });
      onSave(created);
    } finally { setSaving(false); }
  }

  return (
    <ModalShell title="Create billing plan" onClose={onClose}
      footer={<><button type="button" className="ax-btn ax-btn--secondary" onClick={onClose}>Cancel</button><button type="submit" form="create-plan-form" className={`ax-btn ax-btn--primary${saving ? ' is-loading' : ''}`} disabled={saving}><span className="ax-btn__spinner" aria-hidden="true" /><span className="ax-btn__label">Create plan</span></button></>}>
      <form id="create-plan-form" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <div className="ax-field"><label className="ax-label">Plan name</label><input className="ax-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="ax-field"><label className="ax-label">Description</label><textarea className="ax-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="ax-field"><label className="ax-label">Price</label><input className="ax-input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
          <div className="ax-field"><label className="ax-label">Currency</label><select className="ax-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>{['USD', 'EUR', 'GBP', 'INR', 'CHF'].map((v) => <option key={v}>{v}</option>)}</select></div>
        </div>
        <div className="ax-field"><label className="ax-label">Features</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>{features.map((f) => <span key={f} style={{ padding: '4px 9px', borderRadius: 99, background: 'var(--ax-surface-subtle)', fontSize: 'var(--ax-text-xs)' }}>{f}<button type="button" onClick={() => setFeatures((old) => old.filter((x) => x !== f))} style={{ border: 0, background: 'none', cursor: 'pointer', marginLeft: 6 }}>×</button></span>)}</div><div style={{ display: 'flex', gap: 8 }}><input className="ax-input" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} placeholder="Add feature" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), featureInput.trim() && (setFeatures((old) => [...old, featureInput.trim()]), setFeatureInput('')))} /><button type="button" className="ax-btn ax-btn--secondary" onClick={() => { if (featureInput.trim()) { setFeatures((old) => [...old, featureInput.trim()]); setFeatureInput(''); } }}>Add</button></div></div>
      </form>
    </ModalShell>
  );
}

function FeatureValueView({ value }: { value: FeatureValue }) {
  if (typeof value === 'boolean') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, background: value ? 'color-mix(in oklch,var(--ax-viz-emerald) 13%,transparent)' : 'var(--ax-surface-subtle)', color: value ? 'var(--ax-viz-emerald)' : 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)', fontWeight: 650 }}>{value ? IC_CHECK : IC_CROSS}{value ? 'Enabled' : 'Disabled'}</span>;
  }
  if (typeof value === 'number') {
    return <strong style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</strong>;
  }
  return <strong style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{value}</strong>;
}

function PlanCard({ plan, isCurrent, onEdit, canEdit }: {
  plan: AdminPlan; isCurrent: boolean; onEdit: (plan: AdminPlan) => void; canEdit: boolean;
}) {
  const features = toFeatureObject(plan.features);
  const entries = Object.entries(features);
  const currencySymbol: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', CHF: 'CHF ' };
  return (
    <article className="ax-card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', border: isCurrent ? '2px solid var(--ax-accent)' : undefined, opacity: plan.isActive ? 1 : .72, transition: 'transform .2s ease, box-shadow .2s ease' }}>
      {canEdit && <button type="button" onClick={() => onEdit(plan)} title={`Edit ${plan.name}`} aria-label={`Edit ${plan.name}`} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--ax-border)', background: 'var(--ax-surface-raised)', color: 'var(--ax-text-muted)', cursor: 'pointer', fontSize: 12, boxShadow: 'var(--ax-shadow-sm)' }}>{IC_EDIT}<span>Edit</span></button>}
      {isCurrent && <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', fontSize: 'var(--ax-text-xs)', fontWeight: 700, padding: '3px 11px', borderRadius: 99, whiteSpace: 'nowrap' }}>Current plan</span>}
      <div className="ax-card__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', paddingTop: canEdit ? 48 : undefined }}>
        <div style={{ paddingRight: canEdit ? 38 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{plan.name}</h3>
            {!plan.isActive && <span style={{ fontSize: 10, borderRadius: 99, padding: '3px 7px', background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)' }}>Inactive</span>}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{plan.description || 'A plan designed for your organisation.'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 'var(--ax-text-3xl)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)', fontVariantNumeric: 'tabular-nums' }}>{currencySymbol[plan.currency] ?? `${plan.currency} `}{plan.price.toLocaleString()}</span>
          <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>/ {plan.billingCycle || 'month'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          {[
            ['Campaigns', plan.maxCampaigns],
            ['Campaigns / day', plan.maxCampaignsPerDay],
            ['Users', plan.maxUsers],
            ['Trial days', plan.trialDays],
          ].map(([label, value]) => <div key={String(label)} style={{ padding: '9px 10px', borderRadius: 9, background: 'var(--ax-surface-subtle)' }}><div style={{ color: 'var(--ax-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div><div style={{ marginTop: 3, fontWeight: 700, color: 'var(--ax-text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value === null ? 'Unlimited' : Number(value).toLocaleString()}</div></div>)}
        </div>
        {entries.length > 0 && <div><p style={{ margin: '0 0 9px', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Included features</p><ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>{entries.map(([key, value]) => <li key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text)' }}>{featureLabel(key)}</span><FeatureValueView value={value} /></li>)}</ul></div>}
        <a href={PRICING_URL} className={`ax-btn ax-btn--block${isCurrent ? ' ax-btn--secondary' : ' ax-btn--primary'}`} style={{ marginTop: 'auto', textDecoration: 'none', justifyContent: 'center' }}>{IC_STRIPE}<span className="ax-btn__label">{isCurrent ? 'View subscription' : 'Subscribe'}</span></a>
      </div>
    </article>
  );
}

function SubscriptionCard({ sub, onCancel, cancelling }: { sub: Subscription; onCancel: () => void; cancelling: boolean }) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="ax-card ax-card--filled">
      <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Current Subscription</h2></div><SubStatusBadge status={sub.status} /></div>
      <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--ax-space-5)' }}>
        <div><p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase' }}>Plan</p><p style={{ margin: '4px 0 0', fontWeight: 600, color: 'var(--ax-text-strong)' }}>{sub.planName || sub.planId}</p></div>
        <div><p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase' }}>Period start</p><p style={{ margin: '4px 0 0', color: 'var(--ax-text)' }}>{fmt(sub.currentPeriodStart)}</p></div>
        <div><p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase' }}>Period end</p><p style={{ margin: '4px 0 0', color: 'var(--ax-text)' }}>{fmt(sub.currentPeriodEnd)}</p></div>
        {sub.stripeSubscriptionId && <div><p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase' }}>Stripe ID</p><p style={{ margin: '4px 0 0', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{sub.stripeSubscriptionId}</p></div>}
      </div>
      {sub.status === 'active' && !sub.cancelAtPeriodEnd && <div className="ax-card__footer ax-cluster" style={{ justifyContent: 'flex-end' }}><button type="button" className={`ax-btn ax-btn--danger ax-btn--ghost${cancelling ? ' is-loading' : ''}`} aria-busy={cancelling} onClick={onCancel}><span className="ax-btn__spinner" aria-hidden="true" />{IC_CANCEL}<span className="ax-btn__label">Cancel subscription</span></button></div>}
      {sub.cancelAtPeriodEnd && <div className="ax-card__footer"><p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-warning-500)' }}>Your subscription will cancel at the end of the current billing period ({fmt(sub.currentPeriodEnd)}).</p></div>}
    </div>
  );
}

export function Billing() {
  const userRole = useAuthStore((state) => state.userRole);
  const adminToken = useAuthStore((state) => state.adminToken);
  const canEditPlans = userRole === 'admin' && Boolean(adminToken);

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');
  const handleApiError = useApiErrorHandler();

  useEffect(() => {
    let alive = true;
    Promise.allSettled([listBillingPlans(), getCurrentSubscription()])
      .then(([plansResult, subscriptionResult]) => {
        if (!alive) return;
        if (plansResult.status === 'fulfilled') setPlans(plansResult.value.map(normalizePlan));
        if (subscriptionResult.status === 'fulfilled') setSub(subscriptionResult.value);
        for (const result of [plansResult, subscriptionResult]) {
          if (result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401) {
            handleApiError(result.reason);
            return;
          }
        }
        const errors = [plansResult, subscriptionResult].flatMap((result) => result.status === 'rejected'
          ? [result.reason instanceof Error ? result.reason.message : 'Unable to load billing data.'] : []);
        setLoadError(errors.join(' '));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 4000);
  }

  function onPlanCreated(plan: BillingPlan) {
    setPlans((current) => [...current, normalizePlan(plan)]);
    setShowCreate(false);
    showToast(`Plan "${plan.name}" created successfully.`);
  }

  function onPlanUpdated(plan: AdminPlan) {
    setPlans((current) => current.map((item) => item.id === plan.id ? plan : item));
    setEditingPlan(null);
    showToast(`Plan "${plan.name}" updated successfully.`);
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the billing period.')) return;
    if (!sub) return;
    setCancelling(true);
    try {
      setSub(await cancelSubscription(sub.id));
      showToast('Subscription cancellation scheduled at period end.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to cancel subscription.');
    } finally { setCancelling(false); }
  }

  const currentPlanId = sub?.status !== 'cancelled' && sub?.status !== 'none' ? sub?.planId : null;

  return <>
    {showCreate && canEditPlans && <CreatePlanModal onClose={() => setShowCreate(false)} onSave={onPlanCreated} />}
    {editingPlan && canEditPlans && <PlanEditorModal plan={editingPlan} onClose={() => setEditingPlan(null)} onSaved={onPlanUpdated} />}
    {toast && <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 'var(--ax-space-6)', right: 'var(--ax-space-6)', zIndex: 2000, background: 'var(--ax-surface-raised)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-3) var(--ax-space-5)', boxShadow: 'var(--ax-shadow-lg)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{toast}</div>}
    <PageHead title="Billing & Plans" subtitle="Manage your subscription and available billing plans." actions={canEditPlans ? <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setShowCreate(true)}>{IC_PLUS}<span className="ax-btn__label">Create Plan</span></button> : undefined} />
    {loadError && <div role="alert" className="ax-alert ax-alert--danger"><p className="ax-alert__message">{loadError}</p></div>}
    {loading ? <div className="ax-skeleton" style={{ width: '100%', height: 120, borderRadius: 'var(--ax-radius-xl)', marginBottom: 'var(--ax-space-6)' }} /> : sub ? <div style={{ marginBottom: 'var(--ax-space-6)' }}><SubscriptionCard sub={sub} onCancel={handleCancel} cancelling={cancelling} /></div> : null}
    <div style={{ marginBottom: 'var(--ax-space-4)' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Available Plans</h2>
      <p style={{ margin: '4px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Compare plan limits and features. Subscribe opens the Phause pricing page.</p>
      {canEditPlans && <p style={{ margin: '6px 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)' }}>Super Admin access: plan editing is enabled.</p>}
    </div>
    {loading ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--ax-space-5)' }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ax-skeleton" style={{ height: 390, borderRadius: 'var(--ax-radius-xl)' }} />)}</div>
      : plans.length === 0 ? <div className="ax-card"><div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10)', color: 'var(--ax-text-subtle)' }}>No plans are available yet.</div></div>
      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--ax-space-5)', paddingTop: 'var(--ax-space-4)' }}>{plans.map((plan) => <PlanCard key={plan.id} plan={plan} isCurrent={plan.id === currentPlanId} canEdit={canEditPlans} onEdit={setEditingPlan} />)}</div>}
  </>;
}

export default Billing;

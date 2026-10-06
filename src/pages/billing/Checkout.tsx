/*
 * Phause — Billing Checkout.
 *
 * Shows plan selection cards and redirects to Stripe Checkout when a plan is chosen.
 * Covers:
 *   GET  /api/plans                         — List plans (pricing cards)
 *   GET  /api/subscriptions/current         — Current subscription status
 *   POST /api/subscriptions/checkout        — Create Stripe checkout session → redirect
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/shell/PageHead';
import {
  listBillingPlans,
  createCheckoutSession,
  getCurrentSubscription,
  type BillingPlan,
  type Subscription,
} from '../../api/billing/billing.api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IC_CHECK = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const IC_STRIPE = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
    <path d="M9.5 9.5c0-1.1.9-2 2-2h1.5a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4H14"/>
  </svg>
);
const IC_BACK = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M5 12l7 7M5 12l7-7" />
  </svg>
);

// ── Status badge ──────────────────────────────────────────────────────────────
const SUB_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  active:    { bg: 'color-mix(in oklch,var(--ax-viz-emerald) 15%,transparent)', fg: 'var(--ax-viz-emerald)',   label: 'Active' },
  trialing:  { bg: 'color-mix(in oklch,var(--ax-viz-cyan) 15%,transparent)',    fg: 'var(--ax-viz-cyan)',      label: 'Trial' },
  past_due:  { bg: 'color-mix(in oklch,var(--ax-warning-500) 15%,transparent)', fg: 'var(--ax-warning-500)',   label: 'Past Due' },
  cancelled: { bg: 'color-mix(in oklch,var(--ax-danger-500) 12%,transparent)',  fg: 'var(--ax-danger-500)',    label: 'Cancelled' },
  none:      { bg: 'var(--ax-surface-subtle)',                                   fg: 'var(--ax-text-muted)',    label: 'No subscription' },
};

function SubStatusBadge({ status }: { status: string }) {
  const s = SUB_STATUS[status] ?? SUB_STATUS.none;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 99,
        background: s.bg, color: s.fg,
        fontSize: 'var(--ax-text-sm)', fontWeight: 600,
      }}
    >
      <i style={{ width: 7, height: 7, borderRadius: '50%', background: s.fg, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ── Active subscription banner ─────────────────────────────────────────────────
function ActiveSubscriptionBanner({ sub }: { sub: Subscription }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="ax-card ax-card--filled" style={{ marginBottom: 'var(--ax-space-6)' }}>
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Current Subscription</h2>
          <p className="ax-card__subtitle">{sub.planName || sub.planId}</p>
        </div>
        <SubStatusBadge status={sub.status} />
      </div>
      <div
        className="ax-card__body"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
          gap: 'var(--ax-space-5)',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Period start</p>
          <p style={{ margin: '4px 0 0', color: 'var(--ax-text)' }}>{fmt(sub.currentPeriodStart)}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Period end</p>
          <p style={{ margin: '4px 0 0', color: 'var(--ax-text)' }}>{fmt(sub.currentPeriodEnd)}</p>
        </div>
        {sub.stripeSubscriptionId && (
          <div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Stripe ID</p>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{sub.stripeSubscriptionId}</p>
          </div>
        )}
        {sub.cancelAtPeriodEnd && (
          <div style={{ gridColumn: '1/-1' }}>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-warning-500)' }}>
              ⚠ Cancellation scheduled — remains active until {fmt(sub.currentPeriodEnd)}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  isCurrent,
  onCheckout,
  checkingOut,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  onCheckout: (plan: BillingPlan) => void;
  checkingOut: string | null;
}) {
  const highlighted = plan.name === 'Professional';
  const currencySymbol =
    plan.priceCurrency === 'USD' ? '$' :
    plan.priceCurrency === 'EUR' ? '€' :
    plan.priceCurrency === 'GBP' ? '£' : '';

  return (
    <div
      className="ax-card"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        border: isCurrent || highlighted ? '2px solid var(--ax-accent)' : undefined,
      }}
    >
      {/* Badge */}
      {(isCurrent || highlighted) && (
        <span
          style={{
            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--ax-accent)', color: 'var(--ax-on-accent)',
            fontSize: 'var(--ax-text-xs)', fontWeight: 700,
            padding: '2px 10px', borderRadius: 99, whiteSpace: 'nowrap',
          }}
        >
          {isCurrent ? 'Current plan' : 'Most popular'}
        </span>
      )}

      <div className="ax-card__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
        {/* Name + description */}
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>
            {plan.name}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            {plan.description}
          </p>
        </div>

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ax-space-1)' }}>
          <span style={{ fontSize: 'var(--ax-text-3xl)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)', fontVariantNumeric: 'tabular-nums' }}>
            {currencySymbol}{plan.priceMonthly}
          </span>
          <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>/ month</span>
        </div>

        {/* Features */}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', flex: 1 }}>
          {plan.features.map((f) => (
            <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
              <span style={{ color: 'var(--ax-viz-emerald)', flexShrink: 0, marginTop: 2 }}>{IC_CHECK}</span>
              {f}
            </li>
          ))}
          {plan.maxEmployees !== null && (
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
              <span style={{ color: 'var(--ax-text-subtle)', flexShrink: 0, marginTop: 2 }}>{IC_CHECK}</span>
              Up to {plan.maxEmployees.toLocaleString()} employees
            </li>
          )}
          {plan.maxCampaigns !== null && (
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
              <span style={{ color: 'var(--ax-text-subtle)', flexShrink: 0, marginTop: 2 }}>{IC_CHECK}</span>
              {plan.maxCampaigns} campaigns/month
            </li>
          )}
        </ul>

        {/* CTA */}
        <button
          type="button"
          disabled={isCurrent || checkingOut !== null}
          className={`ax-btn ax-btn--block${isCurrent ? ' ax-btn--secondary' : ' ax-btn--primary'}${checkingOut === plan.id ? ' is-loading' : ''}`}
          aria-busy={checkingOut === plan.id}
          onClick={() => !isCurrent && onCheckout(plan)}
        >
          <span className="ax-btn__spinner" aria-hidden="true" />
          {IC_STRIPE}
          <span className="ax-btn__label">{isCurrent ? 'Current plan' : 'Subscribe'}</span>
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function BillingCheckout() {
  const [plans, setPlans]             = useState<BillingPlan[]>([]);
  const [sub, setSub]                 = useState<Subscription | null>(null);
  const [loading, setLoading]         = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [toast, setToast]             = useState('');
  const [loadError, setLoadError]     = useState('');

  useEffect(() => {
    Promise.allSettled([listBillingPlans(), getCurrentSubscription()])
      .then(([plansResult, subResult]) => {
        if (plansResult.status === 'fulfilled') setPlans(plansResult.value);
        if (subResult.status === 'fulfilled') setSub(subResult.value);

        const errors = [plansResult, subResult].flatMap((r) =>
          r.status === 'rejected'
            ? [r.reason instanceof Error ? r.reason.message : 'Unable to load billing data.']
            : [],
        );
        if (errors.length) setLoadError(errors.join(' '));
      })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function handleCheckout(plan: BillingPlan) {
    setCheckingOut(plan.id);
    try {
      const session = await createCheckoutSession(plan.id);
      if (session.url) {
        window.location.href = session.url;
      } else {
        showToast('No redirect URL returned — please check your Stripe configuration.');
      }
    } catch {
      showToast('Failed to create checkout session. Please try again.');
    } finally {
      setCheckingOut(null);
    }
  }

  const currentPlanId =
    sub && sub.status !== 'cancelled' && sub.status !== 'none' ? sub.planId : null;

  const isActiveSubscription = sub && (sub.status === 'active' || sub.status === 'trialing');

  return (
    <>
      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: 'var(--ax-space-6)', right: 'var(--ax-space-6)', zIndex: 2000,
            background: 'var(--ax-surface-raised)', border: '1px solid var(--ax-border)',
            borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-3) var(--ax-space-5)',
            boxShadow: 'var(--ax-shadow-lg)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────── */}
      <PageHead
        title="Choose a Plan"
        subtitle="Select a plan below to proceed to Stripe Checkout."
        actions={
          <Link to="/billing" className="ax-btn ax-btn--secondary">
            {IC_BACK}
            <span className="ax-btn__label">Back to Billing</span>
          </Link>
        }
      />

      {/* ── Load error ────────────────────────────────────────────────── */}
      {loadError && (
        <div role="alert" className="ax-alert ax-alert--danger" style={{ marginBottom: 'var(--ax-space-6)' }}>
          <p className="ax-alert__message">{loadError}</p>
        </div>
      )}

      {/* ── Active subscription status ─────────────────────────────────── */}
      {!loading && isActiveSubscription && <ActiveSubscriptionBanner sub={sub!} />}

      {/* ── Plans section header ───────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--ax-space-4)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>
          Available Plans
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
          Clicking Subscribe will open Stripe Checkout to complete payment.
        </p>
      </div>

      {/* ── Plans grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--ax-space-5)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ax-skeleton" style={{ height: 320, borderRadius: 'var(--ax-radius-xl)' }} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="ax-card">
          <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10)', color: 'var(--ax-text-subtle)' }}>
            No plans are available yet.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
            gap: 'var(--ax-space-5)',
            paddingTop: 'var(--ax-space-4)',
          }}
        >
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              isCurrent={p.id === currentPlanId}
              onCheckout={handleCheckout}
              checkingOut={checkingOut}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default BillingCheckout;

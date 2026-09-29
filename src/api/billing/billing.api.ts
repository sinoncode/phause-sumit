/*
 * Phause — Billing API (Extras — Plans & Subscriptions).
 *
 * All routes use appToken (Bearer).
 * Endpoints:
 *   POST   /api/plans                             — Create plan
 *   GET    /api/plans                             — List plans
 *   POST   /api/subscriptions/checkout            — Create Stripe checkout session
 *   GET    /api/subscriptions/current             — Get current subscription
 *   POST   /api/subscriptions/:id/cancel          — Cancel subscription
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceCurrency: string;
  features: string[];
  maxEmployees: number | null;
  maxCampaigns: number | null;
  stripePriceId: string;
}

export interface Subscription {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'none';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export type BillingPlanFormValues = Omit<BillingPlan, 'id' | 'stripePriceId'>;

// ── Adapters ──────────────────────────────────────────────────────────────────

function adaptPlan(raw: Record<string, unknown>): BillingPlan {
  const features = raw.features && typeof raw.features === 'object'
    ? raw.features as Record<string, unknown>
    : {};
  return {
    id:            String(raw.id ?? ''),
    name:          String(raw.name ?? ''),
    description:   String(raw.description ?? ''),
    priceMonthly:  Number(raw.priceMonthly ?? raw.price_monthly ?? raw.price ?? 0),
    priceCurrency: String(raw.priceCurrency ?? raw.price_currency ?? raw.currency ?? 'USD'),
    features:      Array.isArray(raw.features) ? raw.features as string[] : Object.entries(features).filter(([, enabled]) => Boolean(enabled)).map(([feature]) => feature),
    maxEmployees:  raw.maxEmployees != null ? Number(raw.maxEmployees) : raw.maxUsers != null ? Number(raw.maxUsers) || null : null,
    maxCampaigns:  raw.maxCampaigns != null ? Number(raw.maxCampaigns) : raw.max_campaigns != null ? Number(raw.max_campaigns) : null,
    stripePriceId: String(raw.gatewayPriceId ?? raw.gateway_price_id ?? raw.stripePriceId ?? raw.stripe_price_id ?? ''),
  };
}

function adaptSubscription(rawResponse: Record<string, unknown>): Subscription {
  const raw = (rawResponse.subscription && typeof rawResponse.subscription === 'object'
    ? rawResponse.subscription
    : rawResponse) as Record<string, unknown>;
  const status = String(raw.status ?? 'none').toLowerCase();
  return {
    id:                   String(raw.id ?? ''),
    planId:               String(raw.planId ?? raw.plan_id ?? ''),
    planName:             String((raw.plan as Record<string, unknown> | undefined)?.name ?? raw.planName ?? raw.plan_name ?? ''),
    status:               (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'cancelled' ? status : 'none') as Subscription['status'],
    currentPeriodStart:   String(raw.startDate ?? raw.start_date ?? raw.currentPeriodStart ?? raw.current_period_start ?? ''),
    currentPeriodEnd:     String(raw.endDate ?? raw.end_date ?? raw.currentPeriodEnd ?? raw.current_period_end ?? ''),
    cancelAtPeriodEnd:    typeof raw.cancelAtPeriodEnd === 'boolean'
      ? raw.cancelAtPeriodEnd
      : typeof raw.cancel_at_period_end === 'boolean'
        ? raw.cancel_at_period_end
        : raw.autoRenew === false || status === 'cancelled',
    stripeSubscriptionId: raw.gatewaySubscriptionId ? String(raw.gatewaySubscriptionId) : raw.gateway_subscription_id ? String(raw.gateway_subscription_id) : null,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Create a billing plan */
export async function createBillingPlan(values: BillingPlanFormValues): Promise<BillingPlan> {
  const raw = await apiClient.post<Record<string, unknown>>('/api/plans', getAppToken, {
    name: values.name,
    description: values.description,
    price: values.priceMonthly,
    currency: values.priceCurrency.toLowerCase(),
    billingCycle: 'MONTHLY',
    maxCampaigns: values.maxCampaigns ?? 0,
    maxUsers: values.maxEmployees ?? 0,
    features: Object.fromEntries(values.features.map((feature) => [feature, true])),
  });
  return adaptPlan(raw);
}

/** List all billing plans */
export async function listBillingPlans(): Promise<BillingPlan[]> {
  const raw = await apiClient.get<unknown[]>('/api/plans', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The plans API returned an invalid response.');
  return raw.map((r) => adaptPlan(r as Record<string, unknown>));
}

/** Create a Stripe checkout session for a given plan */
export async function createCheckoutSession(planId: string): Promise<CheckoutSession> {
  const raw = await apiClient.post<Record<string, unknown>>(
    '/api/subscriptions/checkout', getAppToken, { planId },
  );
  return {
    sessionId: String(raw.sessionId ?? raw.session_id ?? raw.id ?? ''),
    url:       String(raw.url ?? raw.checkoutUrl ?? raw.checkout_url ?? ''),
  };
}

/** Get the current subscription for the org */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  const raw = await apiClient.get<Record<string, unknown> | null>('/api/subscriptions/current', getAppToken);
  return raw ? adaptSubscription(raw) : null;
}

/** Cancel the current subscription (at period end) */
export async function cancelSubscription(subscriptionId: string): Promise<Subscription> {
  const raw = await apiClient.post<Record<string, unknown>>(
    `/api/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, getAppToken,
  );
  return adaptSubscription(raw);
}

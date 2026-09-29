/*
 * Phause — Campaign Tracking Events API.
 *
 * The backend does NOT expose a direct "list raw tracking events for a campaign"
 * endpoint. Tracking events are recorded internally when recipients interact
 * with phishing emails (pixel loads, link clicks, landing views, form submits).
 *
 * The closest public API is:
 *   GET /api/risk-scores          → per-employee risk scores (includes campaignId)
 *   GET /api/risk-scores/trend    → aggregated per-campaign metrics
 *
 * We derive "tracking event" records from risk-score rows that match the given
 * campaignId. Each risk-score row represents a click/submit interaction, so we
 * synthesise link_click events from them.
 *
 * If the backend adds a dedicated tracking-events list endpoint in the future,
 * swap out the implementation below — the calling components won't need to change.
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';
import type { TrackingEvent, TrackingEventType } from '../../pages/campaigns/trackingEventsData';

interface RawRiskScore {
  id?: unknown;
  userId?: unknown;
  user_id?: unknown;
  campaignId?: unknown;
  campaign_id?: unknown;
  employeeName?: unknown;
  employee_name?: unknown;
  employeeEmail?: unknown;
  employee_email?: unknown;
  email?: unknown;
  token?: unknown;
  type?: unknown;
  eventType?: unknown;
  event_type?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  computedAt?: unknown;
  riskScore?: unknown;
  ipAddress?: unknown;
  ip_address?: unknown;
  userAgent?: unknown;
  user_agent?: unknown;
}

function deriveEventType(raw: RawRiskScore): TrackingEventType {
  const t = String(raw.type ?? raw.eventType ?? raw.event_type ?? '').toLowerCase();
  if (t === 'pixel_open' || t === 'opened' || t === 'open') return 'pixel_open';
  if (t === 'landing_view' || t === 'landing') return 'landing_view';
  // Default for risk-score records: a click event occurred (that's what creates the score)
  return 'link_click';
}

function adaptRiskScoreToEvent(raw: RawRiskScore): TrackingEvent | null {
  const userId = String(raw.userId ?? raw.user_id ?? '');
  const campaignId = String(raw.campaignId ?? raw.campaign_id ?? '');
  if (!userId || !campaignId) return null;

  const ipAddress = raw.ipAddress ?? raw.ip_address;
  const userAgent = raw.userAgent ?? raw.user_agent;

  return {
    id: String(raw.id ?? `${userId}-${campaignId}`),
    campaignId,
    employee: {
      id: userId,
      name: String(raw.employeeName ?? raw.employee_name ?? ''),
      email: String(raw.employeeEmail ?? raw.employee_email ?? raw.email ?? ''),
    },
    trackingToken: String(raw.token ?? ''),
    eventType: deriveEventType(raw),
    occurredAt: String(raw.createdAt ?? raw.created_at ?? raw.computedAt ?? ''),
    meta: {
      ...(ipAddress ? { ipAddress: String(ipAddress) } : {}),
      ...(userAgent ? { userAgent: String(userAgent) } : {}),
    },
  };
}

export async function listCampaignTrackingEvents(campaignId: string): Promise<TrackingEvent[]> {
  // Use risk-scores endpoint — filter server-side by userId not available,
  // so fetch all and filter client-side by campaignId.
  const raw = await apiClient.get<RawRiskScore[]>('/api/risk-scores', getAppToken);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => String(item.campaignId ?? item.campaign_id ?? '') === campaignId)
    .map(adaptRiskScoreToEvent)
    .filter((event): event is TrackingEvent => event !== null);
}

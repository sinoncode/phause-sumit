/*
 * Phause — Campaign Tracking Events API.
 *
 * Uses the dedicated backend endpoint:
 *   GET /api/tracking/events/:campaignId   (authenticated — Bearer + x-tenant-id)
 *
 * Each event row includes ipAddress and userAgent captured at interaction time.
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';
import type { TrackingEvent, TrackingEventType } from '../../pages/campaigns/trackingEventsData';

interface RawTrackingEvent {
  id?: unknown;
  campaignId?: unknown;
  userId?: unknown;
  // Backend now returns enriched employee data
  employeeName?: unknown;
  employeeEmail?: unknown;
  type?: unknown;
  token?: unknown;
  ipAddress?: unknown;
  userAgent?: unknown;
  createdAt?: unknown;
}

function deriveEventType(raw: RawTrackingEvent): TrackingEventType {
  const t = String(raw.type ?? '').toLowerCase();
  if (t === 'opened' || t === 'pixel_open' || t === 'open') return 'pixel_open';
  if (t === 'landing_view' || t === 'landing' || t === 'submitted') return 'landing_view';
  if (t === 'clicked' || t === 'link_click' || t === 'click') return 'link_click';
  return 'link_click';
}

function adaptEvent(raw: RawTrackingEvent): TrackingEvent | null {
  const userId = String(raw.userId ?? '');
  const campaignId = String(raw.campaignId ?? '');
  if (!userId || !campaignId) return null;

  const ipAddress = raw.ipAddress ? String(raw.ipAddress) : undefined;
  const userAgent = raw.userAgent ? String(raw.userAgent) : undefined;

  // Use enriched employee data returned by the backend
  const employeeName = raw.employeeName ? String(raw.employeeName) : '';
  const employeeEmail = raw.employeeEmail ? String(raw.employeeEmail) : '';

  return {
    id: String(raw.id ?? `${userId}-${campaignId}-${raw.createdAt}`),
    campaignId,
    employee: {
      id: userId,
      name: employeeName,
      email: employeeEmail,
    },
    trackingToken: String(raw.token ?? ''),
    eventType: deriveEventType(raw),
    occurredAt: String(raw.createdAt ?? ''),
    meta: {
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    },
  };
}

export async function listCampaignTrackingEvents(campaignId: string): Promise<TrackingEvent[]> {
  const raw = await apiClient.get<RawTrackingEvent[]>(
    `/api/tracking/events/${encodeURIComponent(campaignId)}`,
    getAppToken,
  );
  if (!Array.isArray(raw)) return [];
  return raw
    .map(adaptEvent)
    .filter((e): e is TrackingEvent => e !== null);
}

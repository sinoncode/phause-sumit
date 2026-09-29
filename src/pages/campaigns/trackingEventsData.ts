/*
 * Phause — Campaign Tracking Events: shared types and endpoint constants.
 *
 * Coverage: event types 9.1–9.3 only.
 *   9.1 pixel_open   → fired when the recipient's email client loads the 1×1
 *                       tracking pixel embedded in the phishing email.
 *   9.2 link_click   → fired when the recipient clicks the phishing link in the email.
 *   9.3 landing_view → fired when the recipient's browser loads the fake landing page.
 *
 * BEACON ENDPOINTS (write-triggering — never call from the dashboard):
 *   GET /api/tracking/pixel/:trackingToken   (records a pixel_open)
 *   GET /api/tracking/click/:trackingToken   (records a link_click)
 *   GET /api/tracking/landing/:trackingToken (records a landing_view)
 *
 * These are referenced here only as documentation constants so that event type
 * values can be mapped to their originating beacon path in tooltips/comments.
 * The dashboard MUST NOT call them — each call would write a new tracking event.
 *
 * READ endpoint: GET /api/campaigns/:campaignId/tracking-events
 */

// ---------------------------------------------------------------------------
// Beacon path constants — documentation only, never call from the dashboard.
// ---------------------------------------------------------------------------

export const BEACON_PATHS = {
  pixel_open: '/api/tracking/pixel/:trackingToken',
  link_click: '/api/tracking/click/:trackingToken',
  landing_view: '/api/tracking/landing/:trackingToken',
} as const;

// ---------------------------------------------------------------------------
// Read endpoint
// ---------------------------------------------------------------------------

/**
 * Usage: `${TRACKING_EVENTS_ENDPOINT(campaignId)}`
 */
export const TRACKING_EVENTS_ENDPOINT = (campaignId: string) =>
  `/api/campaigns/${encodeURIComponent(campaignId)}/tracking-events`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The three event types in scope for steps 9.1–9.3.
 * 9.4 (credentials_submitted) and 9.5 (reported_phishing) are intentionally
 * excluded from this build.
 */
export type TrackingEventType = 'pixel_open' | 'link_click' | 'landing_view';

/**
 * Minimal employee snapshot embedded in a tracking event.
 * References the same conceptual fields as EmployeeRecord in Employees.tsx
 * (id, name, email) without re-importing that page's internal type, since
 * tracking events only need the identifying trio and EmployeeRecord carries
 * additional fields (department, seniority, etc.) that are irrelevant here.
 */
export interface TrackingEventEmployee {
  id: string;
  name: string;
  email: string;
}

/**
 * Optional enrichment metadata.
 * - ipAddress / userAgent are available for link_click and landing_view
 *   (browser-originated requests), but typically absent for pixel_open
 *   (many email clients strip or proxy headers so data is unreliable).
 */
export interface TrackingEventMeta {
  ipAddress?: string;
  userAgent?: string;
}

/** A single recorded tracking event for a campaign recipient. */
export interface TrackingEvent {
  /** Unique event record identifier. */
  id: string;
  /** The campaign this event belongs to. */
  campaignId: string;
  /** Snapshot of the employee who triggered the event. */
  employee: TrackingEventEmployee;
  /** UUID token issued to this specific recipient when the campaign was dispatched. */
  trackingToken: string;
  /** Which step in the funnel fired this event. */
  eventType: TrackingEventType;
  /** ISO 8601 timestamp of when the event was recorded by the backend. */
  occurredAt: string;
  /** Optional enrichment — typically present for link_click / landing_view. */
  meta?: TrackingEventMeta;
}


/*
 * Phause — Campaigns API (Steps 8.1–8.6 from the Postman collection).
 *
 * All routes use appToken (Bearer).
 * Endpoints:
 *   GET    /api/campaigns              — list all
 *   GET    /api/campaigns/:id          — get one
 *   POST   /api/campaigns              — create
 *   PATCH  /api/campaigns/:id          — update (draft only)
 *   POST   /api/campaigns/:id/dispatch — dispatch
 *   POST   /api/campaigns/:id/cancel   — cancel
 *   GET    /api/templates              — list templates (needed for campaign form)
 *
 * API failures are surfaced to the caller; no synthetic campaigns are returned.
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';
import type { Campaign, CampaignTemplate, CreateCampaignInput, UpdateCampaignInput } from '../../features/campaigns/types';

function apiTargetMode(mode: Campaign['targeting']['targetMode']): string {
  if (mode === 'percentage') return 'random';
  if (mode === 'segment') return 'department';
  return 'all';
}

function apiInput(input: CreateCampaignInput | UpdateCampaignInput): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...input };
  if (input.targetMode) payload.targetMode = apiTargetMode(input.targetMode);
  if (input.targetMode === 'segment' && input.targetSegment) {
    payload.targetSegment = input.targetSegment.startsWith('department:')
      ? input.targetSegment
      : `department:${input.targetSegment}`;
  }
  return payload;
}

function adaptCampaign(raw: Record<string, unknown>): Campaign {
  const rawTargeting = (raw.targeting && typeof raw.targeting === 'object'
    ? raw.targeting
    : {}) as Record<string, unknown>;

  const rawTargetMode = raw.targetMode ?? raw.target_mode ?? rawTargeting.targetMode ?? rawTargeting.target_mode;
  const rawTargetSegment = raw.targetSegment ?? raw.target_segment ?? rawTargeting.targetSegment ?? rawTargeting.target_segment;
  const rawTargetSamplePercent = raw.targetSamplePercent ?? raw.target_sample_percent ?? rawTargeting.targetSamplePercent ?? rawTargeting.target_sample_percent;

  return {
    id:                   String(raw.id ?? ''),
    name:                 String(raw.name ?? ''),
    templateId:           String(raw.templateId ?? raw.template_id ?? ''),
    targeting: {
      targetMode:         ((rawTargetMode) === 'random' ? 'percentage' : (rawTargetMode) === 'department' ? 'segment' : rawTargetMode ?? 'all') as Campaign['targeting']['targetMode'],
      targetSegment:      String(rawTargetSegment ?? '').replace(/^department:/, ''),
      targetSamplePercent: rawTargetSamplePercent != null ? Number(rawTargetSamplePercent) : null,
    },
    staggerWindowMinutes: Number(raw.staggerWindowMinutes ?? raw.stagger_window_minutes ?? 0),
    scheduledAt:          raw.scheduledAt ? String(raw.scheduledAt) : null,
    status:               (raw.status === 'sent' || raw.status === 'completed'
      ? 'completed'
      : raw.status === 'sending' || raw.status === 'running'
        ? 'running'
        : raw.status === 'pending'
          ? (raw.scheduledAt && new Date(String(raw.scheduledAt)).getTime() > Date.now() ? 'scheduled' : 'running')
          : raw.status === 'scheduled' || raw.status === 'cancelled'
            ? raw.status
            : 'draft') as Campaign['status'],
    createdAt:            String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    dispatchedAt:         raw.dispatchedAt ? String(raw.dispatchedAt) : raw.sentAt ? String(raw.sentAt) : null,
  };
}

function adaptTemplate(raw: Record<string, unknown>): CampaignTemplate {
  return {
    id:      String(raw.id ?? ''),
    name:    String(raw.name ?? ''),
    subject: String(raw.subject ?? ''),
  };
}

export const campaignsApiReal = {
  async list(): Promise<Campaign[]> {
    const raw = await apiClient.get<unknown[]>('/api/campaigns', getAppToken);
    if (!Array.isArray(raw)) throw new Error('The campaigns API returned an invalid response.');
    return raw.map((r) => adaptCampaign(r as Record<string, unknown>));
  },

  async getById(id: string): Promise<Campaign | undefined> {
    const raw = await apiClient.get<Record<string, unknown>>(
      `/api/campaigns/${encodeURIComponent(id)}`, getAppToken,
    );
    return adaptCampaign(raw);
  },

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const raw = await apiClient.post<Record<string, unknown>>('/api/campaigns', getAppToken, apiInput(input));
    return adaptCampaign(raw);
  },

  async update(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    const raw = await apiClient.patch<Record<string, unknown>>(
      `/api/campaigns/${encodeURIComponent(id)}`, getAppToken, apiInput(input),
    );
    return adaptCampaign(raw);
  },

  async dispatch(id: string): Promise<Campaign> {
    const raw = await apiClient.post<Record<string, unknown>>(
      `/api/campaigns/${encodeURIComponent(id)}/dispatch`, getAppToken,
    );
    return adaptCampaign(raw);
  },

  async cancel(id: string): Promise<Campaign> {
    const raw = await apiClient.post<Record<string, unknown>>(
      `/api/campaigns/${encodeURIComponent(id)}/cancel`, getAppToken,
    );
    return adaptCampaign(raw);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/campaigns/${encodeURIComponent(id)}`, getAppToken);
  },

  async listTemplates(): Promise<CampaignTemplate[]> {
    const raw = await apiClient.get<unknown[]>('/api/templates', getAppToken);
    if (!Array.isArray(raw)) throw new Error('The templates API returned an invalid response.');
    return raw.map((r) => adaptTemplate(r as Record<string, unknown>));
  },
};

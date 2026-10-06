/*
 * Phause — Templates API (Steps 7.1–7.4 from the Postman collection).
 *
 * All routes use appToken (Bearer).
 * Endpoints:
 *   GET    /api/templates          — list all
 *   GET    /api/templates/:id      — get one
 *   POST   /api/templates          — create
 *   PATCH  /api/templates/:id      — update (not in Postman but standard REST)
 *   DELETE /api/templates/:id      — delete
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';
import type { PhishingTemplate } from '../../pages/templates/Templates';
export interface PredefinedTemplate {
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  category: string;
  difficulty: string;
  lureType: string;
  locale: string;
}

function adapt(raw: Record<string, unknown>): PhishingTemplate {
  return {
    id:                 String(raw.id ?? ''),
    name:               String(raw.name ?? ''),
    subject:            String(raw.subject ?? ''),
    htmlBody:           String(raw.htmlBody ?? raw.html_body ?? raw.body ?? ''),
    textBody:           String(raw.textBody ?? raw.text_body ?? ''),
    lureType:           (raw.lureType ?? raw.lure_type ?? 'urgency') as PhishingTemplate['lureType'],
    category:           (raw.category ?? 'credential-harvest') as PhishingTemplate['category'],
    difficulty:         (raw.difficulty ?? 'medium') as PhishingTemplate['difficulty'],
    disclaimerEnabled:  Boolean(raw.disclaimerEnabled ?? raw.disclaimer_enabled ?? false),
  };
}

export async function listTemplates(): Promise<PhishingTemplate[]> {
  const raw = await apiClient.get<unknown[]>('/api/templates', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The templates API returned an invalid response.');
  return raw.map((r) => adapt(r as Record<string, unknown>));
}

export async function listPredefinedTemplates(): Promise<PredefinedTemplate[]> {
  const raw = await apiClient.get<unknown[]>('/api/templates/predefined', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The predefined templates API returned an invalid response.');
  return raw.map((item) => {
    const preset = item as Record<string, unknown>;
    return {
      key: String(preset.key ?? ''),
      name: String(preset.name ?? ''),
      description: String(preset.description ?? ''),
      subject: String(preset.subject ?? ''),
      htmlBody: String(preset.htmlBody ?? ''),
      textBody: String(preset.textBody ?? ''),
      category: String(preset.category ?? ''),
      difficulty: String(preset.difficulty ?? ''),
      lureType: String(preset.lureType ?? ''),
      locale: String(preset.locale ?? ''),
    };
  });
}

export async function createTemplateFromPredefined(key: string): Promise<PhishingTemplate> {
  const raw = await apiClient.post<Record<string, unknown>>(
    `/api/templates/from-predefined/${encodeURIComponent(key)}`,
    getAppToken,
  );
  return adapt(raw);
}

export async function createTemplate(values: Omit<PhishingTemplate, 'id'>): Promise<PhishingTemplate> {
  const raw = await apiClient.post<Record<string, unknown>>('/api/templates', getAppToken, values);
  return adapt(raw);
}

export async function updateTemplate(id: string, values: Omit<PhishingTemplate, 'id'>): Promise<PhishingTemplate> {
  const raw = await apiClient.patch<Record<string, unknown>>(
    `/api/templates/${encodeURIComponent(id)}`, getAppToken, values,
  );
  return adapt(raw);
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/templates/${encodeURIComponent(id)}`, getAppToken);
}

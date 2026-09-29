/*
 * Phause — Reports & Risk Scores API (Step 10).
 *
 * All 10 endpoints wired to the confirmed backend paths from the Postman collection.
 * API failures are propagated so screens can report them instead of showing demo records.
 *
 * Real endpoints (from Postman):
 *   10.1  POST   /api/reports/campaign/:campaignId/generate
 *   10.2  GET    /api/reports/:reportId
 *   10.3  GET    /api/reports
 *   10.4  GET    /api/reports/:reportId/export.csv
 *   10.5  GET    /api/reports/:reportId/export.pdf
 *   10.6  GET    /api/risk-scores
 *   10.7  GET    /api/risk-scores/trend
 *   10.8  GET    /api/risk-scores/by-department
 *   10.9  GET    /api/reports/template-effectiveness
 *   10.10 GET    /api/reports/training-correlation
 *
 * Auth: all routes use appToken (Bearer header).
 */

import { API_BASE_URL, ApiError, apiClient } from '../client';
import { getAppToken, useAuthStore } from '../../stores/auth.store';
import type {
  DepartmentRisk,
  EmployeeRiskScore,
  ReportSummary,
  RiskTrendPoint,
  TemplateEffectiveness,
  TrainingCorrelationRow,
} from '../../pages/reports/reportsData';
import { listEmployees } from '../employees/employees.api';

// ---------------------------------------------------------------------------
// Shape adapters — normalise the backend response to our frontend types.
// The Postman collection shows the real field names; map them here.
// ---------------------------------------------------------------------------

function adaptReport(raw: Record<string, unknown>): ReportSummary {
  const metrics = (raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : {}) as Record<string, unknown>;
  const sent = Number(metrics.sent ?? raw.totalParticipants ?? 0);
  const submitted = Number(metrics.submitted ?? 0);
  return {
    id:               String(raw.id ?? ''),
    campaignId:       String(raw.campaignId ?? raw.campaign_id ?? ''),
    campaignName:     String(raw.campaignName ?? raw.campaign_name ?? raw.name ?? raw.campaignId ?? ''),
    generatedAt:      String(raw.reportDate ?? raw.report_date ?? raw.createdAt ?? raw.created_at ?? ''),
    status:           'ready',
    totalTargeted:    Number(raw.totalParticipants ?? raw.total_participants ?? raw.totalTargeted ?? 0),
    openRate:         metrics.openRate == null ? null : Number(metrics.openRate),
    clickRate:        Number(raw.clickRate ?? raw.click_rate ?? 0),
    landingRate:      sent ? Number(((submitted / sent) * 100).toFixed(2)) : null,
    aiInsightSnippet: String(raw.summaryText ?? raw.summary_text ?? raw.aiInsight ?? raw.ai_insight ?? raw.summary ?? ''),
  };
}

function adaptRiskScore(raw: Record<string, unknown>, employee?: Awaited<ReturnType<typeof listEmployees>>[number]): EmployeeRiskScore {
  const score = Number(raw.riskScore ?? raw.risk_score ?? raw.score ?? 0);
  const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return {
    employeeId:            String(raw.employeeId ?? raw.employee_id ?? raw.userId ?? raw.id ?? ''),
    name:                  String(raw.name ?? raw.employeeName ?? employee?.name ?? ''),
    email:                 String(raw.email ?? employee?.email ?? ''),
    department:            String(raw.department ?? employee?.department ?? ''),
    riskScore:             score,
    riskLevel:             (raw.riskLevel ?? raw.risk_level ?? level) as EmployeeRiskScore['riskLevel'],
    lastEventAt:           String(raw.lastEventAt ?? raw.last_event_at ?? raw.computedAt ?? raw.computed_at ?? ''),
    campaignsParticipated: Number(raw.campaignsParticipated ?? raw.campaigns_participated ?? (raw.campaignId ? 1 : 0)),
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** 10.1 — Generate report for a campaign. Returns the saved report record. */
export async function generateReport(campaignId: string): Promise<ReportSummary> {
  const raw = await apiClient.post<Record<string, unknown>>(
    `/api/reports/campaign/${encodeURIComponent(campaignId)}/generate`, getAppToken,
  );
  return adaptReport(raw);
}

/** 10.3 — List all reports for the org. */
export async function listReports(): Promise<ReportSummary[]> {
  const raw = await apiClient.get<unknown[]>('/api/reports', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The reports API returned an invalid response.');
  return raw.map((r) => adaptReport(r as Record<string, unknown>));
}

/** 10.2 — Get a single report by ID. */
export async function getReport(reportId: string): Promise<ReportSummary | null> {
  const raw = await apiClient.get<Record<string, unknown>>(
    `/api/reports/${encodeURIComponent(reportId)}`, getAppToken,
  );
  return adaptReport(raw);
}

/** 10.4 and 10.5 — Download a report with its Bearer token. */
export async function downloadReport(reportId: string, format: 'csv' | 'pdf'): Promise<void> {
  const token = getAppToken();
  if (!token) throw new ApiError(401, null, 'Sign in is required to export reports.');
  const response = await fetch(`${API_BASE_URL}/api/reports/${encodeURIComponent(reportId)}/export.${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 401) useAuthStore.getState().clearAll();
    let body: unknown;
    try { body = await response.json(); } catch { body = await response.text(); }
    throw new ApiError(response.status, body, `GET report export → ${response.status}`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `report-${reportId}.${format}`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

/** 10.6 — List all employee risk scores. */
export async function listRiskScores(): Promise<EmployeeRiskScore[]> {
  const [raw, employees] = await Promise.all([
    apiClient.get<unknown[]>('/api/risk-scores', getAppToken),
    listEmployees(),
  ]);
  if (!Array.isArray(raw)) throw new Error('The risk-scores API returned an invalid response.');
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const campaignIdsByUser = new Map<string, Set<string>>();
  for (const value of raw) {
    const item = value as Record<string, unknown>;
    const userId = String(item.userId ?? item.user_id ?? '');
    const campaignId = String(item.campaignId ?? item.campaign_id ?? '');
    if (!userId || !campaignId) continue;
    const campaignIds = campaignIdsByUser.get(userId) ?? new Set<string>();
    campaignIds.add(campaignId);
    campaignIdsByUser.set(userId, campaignIds);
  }
  const latestByUser = new Map<string, Record<string, unknown>>();
  for (const value of raw) {
    const item = value as Record<string, unknown>;
    const userId = String(item.userId ?? item.user_id ?? '');
    if (userId && !latestByUser.has(userId)) latestByUser.set(userId, item);
  }
  return [...latestByUser.entries()].map(([userId, item]) => adaptRiskScore({
    ...item,
    campaignsParticipated: campaignIdsByUser.get(userId)?.size ?? 0,
  }, employeesById.get(userId)));
}

/** 10.7 — Risk score trend over time. */
export async function getRiskTrend(): Promise<RiskTrendPoint[]> {
  const raw = await apiClient.get<unknown[]>('/api/risk-scores/trend', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The risk trend API returned an invalid response.');
  return raw.map((value) => {
    const item = value as Record<string, unknown>;
    return {
      month: String(item.campaignName ?? item.date ?? ''),
      avgRiskScore: Number(item.avgScore ?? 0),
    };
  });
}

export async function getRiskByDepartment(): Promise<DepartmentRisk[]> {
  const raw = await apiClient.get<unknown[]>('/api/risk-scores/by-department', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The department risk API returned an invalid response.');
  return raw.map((value) => {
    const item = value as Record<string, unknown>;
    const score = Number(item.avgScore ?? 0);
    return {
      department: String(item.department ?? ''),
      avgRiskScore: score,
      employeeCount: Number(item.employeeCount ?? 0),
      riskLevel: (score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low') as DepartmentRisk['riskLevel'],
      openRate: null,
      clickRate: Number(item.clickRate ?? 0),
      landingRate: null,
    };
  });
}

/** 10.9 — Template effectiveness. */
export async function getTemplateEffectiveness(): Promise<TemplateEffectiveness[]> {
  const raw = await apiClient.get<unknown[]>('/api/reports/template-effectiveness', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The template effectiveness API returned an invalid response.');
  return raw.map((value) => {
    const item = value as Record<string, unknown>;
    return {
      templateId:     String(item.templateId ?? ''),
      templateName:   String(item.templateName ?? ''),
      lureType:       String(item.lureType ?? ''),
      category:       String(item.category ?? ''),
      timesUsed:      Number(item.campaignCount ?? 0),
      avgOpenRate:    null,
      avgClickRate:   Number(item.clickRate ?? 0),
      avgLandingRate: Number(item.submitRate ?? 0),
    };
  });
}

/** 10.10 — Training correlation. */
export async function getTrainingCorrelation(): Promise<TrainingCorrelationRow[]> {
  const item = await apiClient.get<Record<string, unknown>>('/api/reports/training-correlation', getAppToken);
  const before = Number(item.beforeTrainingClickRate ?? 0);
  const after = Number(item.afterTrainingClickRate ?? 0);
  return [{
    department: 'Organization',
    preTrainingClickRate: before,
    postTrainingClickRate: after,
    improvement: Number(item.improvement ?? before - after),
  }];
}

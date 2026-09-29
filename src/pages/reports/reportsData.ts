/*
 * Phause — Reports & Risk Scores API types and endpoint constants.
 *
 * Covers all 10 sub-items in Step 10:
 *   10.1  POST /api/reports/generate          — Generate AI report for a campaign → returns reportId
 *   10.2  GET  /api/reports/:reportId          — View a single report
 *   10.3  GET  /api/reports                   — List all reports
 *   10.4  GET  /api/reports/:reportId/export/csv  — Export report as CSV
 *   10.5  GET  /api/reports/:reportId/export/pdf  — Export report as PDF
 *   10.6  GET  /api/risk-scores               — List risk scores (all employees)
 *   10.7  GET  /api/risk-scores/trend         — Risk score trend over time
 *   10.8  GET  /api/risk-scores/by-department — Risk scores by department (vulnerability heatmap)
 *   10.9  GET  /api/reports/template-effectiveness — Template effectiveness (lure types)
 *   10.10 GET  /api/reports/training-correlation   — Training correlation (before vs after)
 *
 * Endpoint paths match the NestJS reports and risk controllers.
 */

// ---------------------------------------------------------------------------
// Endpoint constants
// ---------------------------------------------------------------------------

export const REPORT_ENDPOINTS = {
  generate:               '/api/reports/generate',
  list:                   '/api/reports',
  detail:                 (id: string) => `/api/reports/${encodeURIComponent(id)}`,
  exportCsv:              (id: string) => `/api/reports/${encodeURIComponent(id)}/export.csv`,
  exportPdf:              (id: string) => `/api/reports/${encodeURIComponent(id)}/export.pdf`,
  riskScores:             '/api/risk-scores',
  riskTrend:              '/api/risk-scores/trend',
  riskByDepartment:       '/api/risk-scores/by-department',
  templateEffectiveness:  '/api/reports/template-effectiveness',
  trainingCorrelation:    '/api/reports/training-correlation',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportStatus = 'generating' | 'ready' | 'failed';

/** Summary record returned by the list endpoint (10.3). */
export interface ReportSummary {
  id: string;
  campaignId: string;
  campaignName: string;
  generatedAt: string;   // ISO timestamp
  status: ReportStatus;
  totalTargeted: number;
  openRate: number | null; // unavailable when the API has no open-rate metric
  clickRate: number;     // 0–100
  landingRate: number | null;
  aiInsightSnippet: string;
}

/** Full report returned by the detail endpoint (10.2). */
export interface ReportDetail extends ReportSummary {
  aiInsightFull: string;
  recommendations: string[];
  exportCsvUrl: string;
  exportPdfUrl: string;
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

/** Per-employee risk score record (10.6). */
export interface EmployeeRiskScore {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  riskScore: number;     // 0–100
  riskLevel: RiskLevel;
  lastEventAt: string;   // ISO timestamp
  campaignsParticipated: number;
}

/** Single data point for the risk trend chart (10.7). */
export interface RiskTrendPoint {
  month: string;         // e.g. "Sep 2026"
  avgRiskScore: number;
}

/** Department-level vulnerability entry for the heatmap (10.8). */
export interface DepartmentRisk {
  department: string;
  avgRiskScore: number;
  employeeCount: number;
  riskLevel: RiskLevel;
  openRate: number | null;
  clickRate: number;
  landingRate: number | null;
}

/** Template effectiveness entry (10.9). */
export interface TemplateEffectiveness {
  templateId: string;
  templateName: string;
  lureType: string;
  category: string;
  timesUsed: number;
  avgOpenRate: number | null;
  avgClickRate: number;
  avgLandingRate: number;
}

/** Training correlation row (10.10). */
export interface TrainingCorrelationRow {
  department: string;
  preTrainingClickRate: number;
  postTrainingClickRate: number;
  improvement: number;   // percentage-point reduction
}


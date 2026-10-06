/*
 * Phause — Training & Remediation API (Step 11).
 *
 * All routes use appToken (Bearer).
 * Endpoints:
 *   11.1  POST   /api/training/modules              — Create training module
 *   11.2  GET    /api/training/modules              — List training modules
 *   11.3  GET    /api/training/enrolments           — List training enrolments (who needs to do training)
 *   11.4  POST   /api/training/modules/:id/complete — Record training completion
 *   11.5  GET    /api/training/users/:userId/completions — List completions for an employee
 */

import { apiClient } from '../client';
import { getAppToken } from '../../stores/auth.store';
import { listEmployees } from '../employees/employees.api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrainingModule {
  id: string;
  title: string;
  category: string;
  contentRef: string;
  createdAt: string;
}

export interface TrainingEnrolment {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  moduleId: string;
  moduleTitle: string;
  enrolledAt: string;
  status: 'pending' | 'completed';
}

export interface TrainingCompletion {
  id: string;
  employeeId: string;
  moduleId: string;
  moduleTitle: string;
  completedAt: string;
  score: number | null;
}

export type TrainingModuleFormValues = Omit<TrainingModule, 'id' | 'createdAt'>;

// ── Adapters ──────────────────────────────────────────────────────────────────

function adaptModule(raw: Record<string, unknown>): TrainingModule {
  return {
    id:              String(raw.id ?? ''),
    title:           String(raw.title ?? raw.name ?? ''),
    category:        String(raw.category ?? ''),
    contentRef:      String(raw.contentRef ?? raw.content_ref ?? ''),
    createdAt:       String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

function adaptEnrolment(
  raw: Record<string, unknown>,
  employee?: Awaited<ReturnType<typeof listEmployees>>[number],
  module?: TrainingModule,
): TrainingEnrolment {
  return {
    id:            String(raw.id ?? ''),
    employeeId:    String(raw.userId ?? raw.user_id ?? ''),
    employeeName:  employee?.name ?? '',
    employeeEmail: employee?.email ?? '',
    moduleId:      String(raw.moduleId ?? raw.module_id ?? ''),
    moduleTitle:   module?.title ?? '',
    enrolledAt:    String(raw.enrolledAt ?? raw.enrolled_at ?? ''),
    status:        (raw.status === 'completed' ? 'completed' : 'pending'),
  };
}

function adaptCompletion(raw: Record<string, unknown>): TrainingCompletion {
  return {
    id:          String(raw.id ?? ''),
    employeeId:  String(raw.employeeId ?? raw.employee_id ?? ''),
    moduleId:    String(raw.moduleId ?? raw.module_id ?? ''),
    moduleTitle: String(raw.moduleTitle ?? raw.module_title ?? raw.title ?? ''),
    completedAt: String(raw.completedAt ?? raw.completed_at ?? new Date().toISOString()),
    score:       raw.quizScore != null ? Number(raw.quizScore) : raw.score != null ? Number(raw.score) : null,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/** 11.1 — Create a training module */
export async function createTrainingModule(values: TrainingModuleFormValues): Promise<TrainingModule> {
  const raw = await apiClient.post<Record<string, unknown>>('/api/training/modules', getAppToken, {
    name: values.title,
    category: values.category,
    contentRef: values.contentRef,
  });
  return adaptModule(raw);
}

/** 11.2 — List all training modules */
export async function listTrainingModules(): Promise<TrainingModule[]> {
  const raw = await apiClient.get<unknown[]>('/api/training/modules', getAppToken);
  if (!Array.isArray(raw)) throw new Error('The training modules API returned an invalid response.');
  return raw.map((r) => adaptModule(r as Record<string, unknown>));
}

/** 11.3 — List training enrolments (who needs to do training) */
export async function listTrainingEnrolments(): Promise<TrainingEnrolment[]> {
  const [raw, employees, modules] = await Promise.all([
    apiClient.get<unknown[]>('/api/training/enrolments', getAppToken),
    listEmployees(),
    listTrainingModules(),
  ]);
  if (!Array.isArray(raw)) throw new Error('The training enrolments API returned an invalid response.');
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  return raw.map((value) => {
    const item = value as Record<string, unknown>;
    const userId = String(item.userId ?? item.user_id ?? '');
    const moduleId = String(item.moduleId ?? item.module_id ?? '');
    return adaptEnrolment(item, employeesById.get(userId), modulesById.get(moduleId));
  });
}

/** 11.4 — Record a training completion */
export async function recordTrainingCompletion(payload: {
  employeeId: string;
  moduleId: string;
  score?: number;
}): Promise<TrainingCompletion> {
  const raw = await apiClient.post<Record<string, unknown>>(
    `/api/training/modules/${encodeURIComponent(payload.moduleId)}/complete`, getAppToken, {
      userId: payload.employeeId,
      quizScore: payload.score,
    },
  );
  return adaptCompletion(raw);
}

/** 11.5 — List completions for a specific employee */
export async function listCompletionsForEmployee(employeeId: string): Promise<TrainingCompletion[]> {
  const raw = await apiClient.get<unknown[]>(
    `/api/training/users/${encodeURIComponent(employeeId)}/completions`, getAppToken,
  );
  if (!Array.isArray(raw)) throw new Error('The training completions API returned an invalid response.');
  return raw.map((r) => adaptCompletion(r as Record<string, unknown>));
}

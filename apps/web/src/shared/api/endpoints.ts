import type {
  Child,
  ChildListItem,
  ChildListQuery,
  ChildOverview,
  ChildProgression,
  ChildVsGroup,
  CreateChild,
  CreateSession,
  CrossChildPattern,
  Domain,
  ExportFormat,
  KindergartenSummary,
  ReportSubdomain,
  SessionDetail,
  SessionMode,
  SubdomainForPlay,
  SubdomainQuery,
  SubdomainSummary,
  SyncBatch,
  SyncBatchResult,
  UpdateChild,
} from '@kga/contracts';
import { api, apiBlob } from './client';

/**
 * Every call the app makes to the API, in one file.
 *
 * Typed against `@kga/contracts`, which is the same Zod source the server
 * validates with — so a response shape cannot drift from what the client
 * expects without the build failing.
 */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const qs = (params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

/* ── Children ────────────────────────────────────────────────────────────── */

export const listChildren = (query: Partial<ChildListQuery> = {}) =>
  api<Paginated<ChildListItem>>(`/children${qs(query as Record<string, string>)}`);

export const getChildOverview = (id: string) => api<ChildOverview>(`/children/${id}/overview`);

export const createChild = (body: CreateChild) =>
  api<Child>('/children', { method: 'POST', json: body });

export const updateChild = (id: string, body: UpdateChild) =>
  api<Child>(`/children/${id}`, { method: 'PATCH', json: body });

export const deleteChild = (id: string) =>
  api<{ id: string; deleted: boolean }>(`/children/${id}`, { method: 'DELETE' });

export const uploadPhoto = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<{ url: string }>('/media/upload', { method: 'POST', body: form });
};

/* ── Content ─────────────────────────────────────────────────────────────── */

export const listDomains = () => api<Domain[]>('/content/domains');

export const listSubdomains = (query: SubdomainQuery = {}) =>
  api<SubdomainSummary[]>(`/content/subdomains${qs(query as Record<string, string>)}`);

export const getSubdomainForPlay = (id: string) =>
  api<SubdomainForPlay>(`/content/subdomains/${id}`);

/**
 * Resolve a whole plan in one request.
 *
 * The runner used to fetch each subdomain separately; on kindergarten WiFi that
 * is a dozen round trips before the child sees anything.
 */
export const getPlanContent = (ids: string[]) =>
  ids.length === 0
    ? Promise.resolve([] as SubdomainForPlay[])
    : api<SubdomainForPlay[]>(`/content/subdomains/play?ids=${ids.join(',')}`);

/* ── Sessions ────────────────────────────────────────────────────────────── */

export const createSession = (body: CreateSession) =>
  api<SessionDetail>('/sessions', { method: 'POST', json: body });

export const getSession = (id: string) => api<SessionDetail>(`/sessions/${id}`);

export const completeSession = (id: string) =>
  api<SessionDetail>(`/sessions/${id}/complete`, { method: 'POST' });

export const abandonSession = (id: string) =>
  api<SessionDetail>(`/sessions/${id}/abandon`, { method: 'POST' });

export const skipPlanItem = (id: string, subdomainId: string) =>
  api<SessionDetail>(`/sessions/${id}/skip`, { method: 'POST', json: { subdomainId } });

export const syncResults = (batch: SyncBatch) =>
  api<SyncBatchResult>('/sessions/sync', { method: 'POST', json: batch });

export type { SessionMode };

/* ── Reports ─────────────────────────────────────────────────────────────── */

export const getKindergartenSummary = () =>
  api<KindergartenSummary>('/reports/kindergarten/summary');

export const getProgression = (childId: string) =>
  api<ChildProgression>(`/reports/children/${childId}/progression`);

export const getVsGroup = (childId: string) =>
  api<ChildVsGroup>(`/reports/children/${childId}/vs-group`);

export const listReportSubdomains = () => api<ReportSubdomain[]>('/reports/subdomains');

export const getPatterns = (subdomainId: string) =>
  api<CrossChildPattern>(`/reports/subdomains/${subdomainId}/patterns`);

/** Download an export to the device (§12 — PDF/Excel behind ExportPort). */
export async function downloadExport(path: string, format: ExportFormat): Promise<void> {
  const { blob, filename } = await apiBlob(`${path}?format=${format}`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

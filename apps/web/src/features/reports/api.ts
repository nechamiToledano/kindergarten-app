import type {
  ChildProgression,
  ChildVsGroup,
  CrossChildPattern,
  ExportFormat,
  ReportSubdomain,
} from '@kga/contracts';
import { api, apiBlob } from '../../shared/api/client';

export const getProgression = (childId: string) =>
  api<ChildProgression>(`/reports/children/${childId}/progression`);

export const getVsGroup = (childId: string) =>
  api<ChildVsGroup>(`/reports/children/${childId}/vs-group`);

export const listReportSubdomains = () =>
  api<ReportSubdomain[]>('/reports/subdomains');

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

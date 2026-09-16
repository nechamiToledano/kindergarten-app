import type { AuditLogEntry, AuditLogQuery } from '@kga/contracts';
import { api } from '../../shared/api/client';

export const auditApi = {
  list: (query: Partial<AuditLogQuery>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return api<{ items: AuditLogEntry[]; total: number }>(`/audit${qs ? `?${qs}` : ''}`);
  },
};

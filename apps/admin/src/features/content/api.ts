import type {
  CreateDomain,
  CreateSubdomain,
  Domain,
  GameConfig,
  SubdomainForPlay,
  SubdomainQuery,
  SubdomainSummary,
  SubdomainVersion,
  UpdateDomain,
  UpdateSubdomain,
} from '@kga/contracts';
import { api } from '../../shared/api/client';

export const contentApi = {
  /** M10 §1 — domains are global; age is a property of the subdomain now. */
  listDomains: () => api<Domain[]>('/content/domains'),

  createDomain: (body: CreateDomain) =>
    api<Domain>('/content/domains', { method: 'POST', json: body }),

  updateDomain: (id: string, body: UpdateDomain) =>
    api<Domain>(`/content/domains/${id}`, { method: 'PATCH', json: body }),

  deleteDomain: (id: string) =>
    api<{ deleted: true }>(`/content/domains/${id}`, { method: 'DELETE' }),

  listSubdomains: (query: SubdomainQuery) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return api<SubdomainSummary[]>(`/content/subdomains${qs ? `?${qs}` : ''}`);
  },

  getSubdomain: (id: string) => api<SubdomainForPlay>(`/content/subdomains/${id}`),

  createSubdomain: (body: CreateSubdomain) =>
    api<SubdomainForPlay>('/content/subdomains', { method: 'POST', json: body }),

  updateSubdomain: (id: string, body: UpdateSubdomain) =>
    api<SubdomainForPlay>(`/content/subdomains/${id}`, { method: 'PATCH', json: body }),

  deleteSubdomain: (id: string) =>
    api<{ deleted: true }>(`/content/subdomains/${id}`, { method: 'DELETE' }),

  listVersions: (id: string) =>
    api<SubdomainVersion[]>(`/content/subdomains/${id}/versions`),
};

export type { GameConfig };

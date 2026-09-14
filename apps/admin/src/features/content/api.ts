import type {
  AgeGroup,
  CreateDomain,
  CreateSubdomain,
  Domain,
  GameConfig,
  Subdomain,
  SubdomainForPlay,
  SubdomainVersion,
  UpdateDomain,
  UpdateSubdomain,
} from '@kga/contracts';
import { api } from '../../shared/api/client';

export const contentApi = {
  listDomains: (ageGroup?: AgeGroup) =>
    api<Domain[]>(`/content/domains${ageGroup ? `?ageGroup=${ageGroup}` : ''}`),

  createDomain: (body: CreateDomain) =>
    api<Domain>('/content/domains', { method: 'POST', json: body }),

  updateDomain: (id: string, body: UpdateDomain) =>
    api<Domain>(`/content/domains/${id}`, { method: 'PATCH', json: body }),

  deleteDomain: (id: string) =>
    api<{ deleted: true }>(`/content/domains/${id}`, { method: 'DELETE' }),

  listSubdomains: (domainId: string) =>
    api<Subdomain[]>(`/content/domains/${domainId}/subdomains`),

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

/** Media upload (§14.3) — R2 or static, transparently, behind STORAGE_PORT. */
export const mediaApi = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api<{ url: string; key: string; kind: 'image' | 'audio' }>('/media/upload', {
      method: 'POST',
      body: fd,
    });
  },
};

export type { GameConfig };

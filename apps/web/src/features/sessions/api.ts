import type {
  AgeGroup,
  Child,
  CreateChild,
  Domain,
  Session,
  SessionMode,
  SubdomainForPlay,
  UpdateChild,
} from '@kga/contracts';
import { api } from '../../shared/api/client';

export const listChildren = (search?: string, ageGroup?: string) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (ageGroup) params.set('ageGroup', ageGroup);
  const qs = params.toString();
  return api<Child[]>(`/children${qs ? `?${qs}` : ''}`);
};

export const createChild = (body: CreateChild) =>
  api<Child>('/children', { method: 'POST', json: body });

export const updateChild = (id: string, body: UpdateChild) =>
  api<Child>(`/children/${id}`, { method: 'PATCH', json: body });

export const deleteChild = (id: string) => api<{ id: string; deleted: boolean }>(`/children/${id}`, { method: 'DELETE' });

export const uploadPhoto = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api<{ url: string }>('/media/upload', { method: 'POST', body: fd });
};

export const createSession = (childId: string, mode: SessionMode = 'ASSESSMENT') =>
  api<Session>('/sessions', { method: 'POST', json: { childId, mode } });

export const completeSession = (id: string) =>
  api<Session>(`/sessions/${id}/complete`, { method: 'POST' });

export const listDomains = (ageGroup?: AgeGroup) =>
  api<Domain[]>(`/content/domains${ageGroup ? `?ageGroup=${ageGroup}` : ''}`);

export const listSubdomains = (domainId: string) =>
  api<{ id: string; name: string; orderIndex: number }[]>(
    `/content/domains/${domainId}/subdomains`,
  );

export const getSubdomainForPlay = (id: string) =>
  api<SubdomainForPlay>(`/content/subdomains/${id}`);

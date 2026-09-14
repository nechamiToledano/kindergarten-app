import type { CreateUser, Kindergarten, UpdateUser, User } from '@kga/contracts';
import { api } from '../../shared/api/client';

/** Staff & kindergarten management (§14.4). */
export const staffApi = {
  listUsers: () => api<User[]>('/users'),
  createUser: (body: CreateUser) => api<User>('/users', { method: 'POST', json: body }),
  updateUser: (id: string, body: UpdateUser) =>
    api<User>(`/users/${id}`, { method: 'PATCH', json: body }),
  deactivateUser: (id: string) =>
    api<{ deleted: true }>(`/users/${id}`, { method: 'DELETE' }),

  listKindergartens: () => api<Kindergarten[]>('/kindergartens'),
  createKindergarten: (name: string) =>
    api<Kindergarten>('/kindergartens', { method: 'POST', json: { name, networkId: null } }),
  renameKindergarten: (id: string, name: string) =>
    api<Kindergarten>(`/kindergartens/${id}`, { method: 'PATCH', json: { name } }),
};

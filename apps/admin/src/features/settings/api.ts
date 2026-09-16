import type { AppSetting, Network, UpdateNetwork } from '@kga/contracts';
import { api } from '../../shared/api/client';

/** System-wide settings (M11 — real management). NETWORK_ADMIN only, both in the API and here. */
export const settingsApi = {
  list: () => api<AppSetting[]>('/settings'),
  update: (key: string, value: unknown) =>
    api<AppSetting>(`/settings/${key}`, { method: 'PATCH', json: { value } }),
};

export const networkApi = {
  getMine: () => api<Network>('/networks/mine'),
  updateMine: (body: UpdateNetwork) =>
    api<Network>('/networks/mine', { method: 'PATCH', json: body }),
};

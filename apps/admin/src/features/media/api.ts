import type { MediaAsset, MediaAssetQuery } from '@kga/contracts';
import { api } from '../../shared/api/client';

/** The asset library (M11, §14.3 extended) — CONTENT_EDITOR only. */
export const mediaLibraryApi = {
  list: (query: Partial<MediaAssetQuery>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return api<{ items: MediaAsset[]; total: number }>(`/media${qs ? `?${qs}` : ''}`);
  },
  remove: (id: string) => api<{ deleted: true }>(`/media/${id}`, { method: 'DELETE' }),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api<{ url: string; key: string; kind: 'image' | 'audio' }>('/media/upload', {
      method: 'POST',
      body: fd,
    });
  },
};

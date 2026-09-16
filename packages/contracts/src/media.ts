import { z } from 'zod';

/** M11 — the asset library: every upload, catalogued so it can be found and reused. */
export const MediaAssetSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  key: z.string(),
  kind: z.enum(['image', 'audio']),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  originalName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MediaAssetQuerySchema = z.object({
  kind: z.enum(['image', 'audio']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
});
export type MediaAssetQuery = z.infer<typeof MediaAssetQuerySchema>;

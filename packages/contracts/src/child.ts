import { z } from 'zod';
import { AgeGroupSchema } from './common.js';

export const ChildSchema = z.object({
  id: z.uuid(),
  kindergartenId: z.uuid(),
  displayName: z.string().min(1).max(80),
  birthDate: z.iso.date(),
  /** M7 §3.2 — uploaded via the existing POST /media/upload (§14.3), optional. */
  photoUrl: z.url().nullable().default(null),
  /** Server-decorated, read-only — derived from birthDate (§10.1 children module). */
  currentAgeGroup: AgeGroupSchema.optional(),
});
export type Child = z.infer<typeof ChildSchema>;

/** kindergartenId is derived from the caller's tenant scope, never the body. */
export const CreateChildSchema = ChildSchema.omit({
  id: true,
  kindergartenId: true,
  currentAgeGroup: true,
}).extend({
  photoUrl: z.url().nullable().optional(),
});
export type CreateChild = z.infer<typeof CreateChildSchema>;

export const UpdateChildSchema = CreateChildSchema.partial();
export type UpdateChild = z.infer<typeof UpdateChildSchema>;

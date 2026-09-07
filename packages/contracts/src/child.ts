import { z } from 'zod';

export const ChildSchema = z.object({
  id: z.uuid(),
  kindergartenId: z.uuid(),
  displayName: z.string().min(1).max(80),
  birthDate: z.iso.date(),
});
export type Child = z.infer<typeof ChildSchema>;

/** kindergartenId is derived from the caller's tenant scope, never the body. */
export const CreateChildSchema = ChildSchema.omit({ id: true, kindergartenId: true });
export type CreateChild = z.infer<typeof CreateChildSchema>;

export const UpdateChildSchema = CreateChildSchema.partial();
export type UpdateChild = z.infer<typeof UpdateChildSchema>;

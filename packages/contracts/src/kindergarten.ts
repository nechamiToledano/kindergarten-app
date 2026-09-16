import { z } from 'zod';

export const KindergartenSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  /** Null = isolated kindergarten; set = part of a network (§9.2). */
  networkId: z.uuid().nullable(),
});
export type Kindergarten = z.infer<typeof KindergartenSchema>;

export const CreateKindergartenSchema = KindergartenSchema.omit({ id: true }).extend({
  networkId: z.uuid().nullable().default(null),
});
export type CreateKindergarten = z.infer<typeof CreateKindergartenSchema>;

export const UpdateKindergartenSchema = CreateKindergartenSchema.partial();
export type UpdateKindergarten = z.infer<typeof UpdateKindergartenSchema>;

/** M11 — a network admin's own network, for self-service rename (§14.4 extended). */
export const NetworkSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  kindergartenCount: z.number().int(),
});
export type Network = z.infer<typeof NetworkSchema>;

export const UpdateNetworkSchema = z.object({ name: z.string().min(1).max(120) });
export type UpdateNetwork = z.infer<typeof UpdateNetworkSchema>;

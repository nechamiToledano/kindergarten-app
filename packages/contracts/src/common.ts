import { z } from 'zod';

/** Branded UUID used for every entity id crossing the network boundary. */
export const UuidSchema = z.uuid();

/** Spec §5 — קיים / קיים חלקית / לא קיים. The teacher always sets this manually. */
export const RatingSchema = z.enum(['PRESENT', 'PARTIALLY_PRESENT', 'ABSENT']);
export type Rating = z.infer<typeof RatingSchema>;

/** Spec §13.1 role model. CONTENT_EDITOR deliberately has no child-data access. */
export const RoleSchema = z.enum([
  'TEACHER',
  'KINDERGARTEN_ADMIN',
  'NETWORK_ADMIN',
  'CONTENT_EDITOR',
]);
export type Role = z.infer<typeof RoleSchema>;

/** Spec §9 — the three screening age bands. */
export const AgeGroupSchema = z.enum(['AGE_3_4', 'AGE_4_5', 'AGE_5_6']);
export type AgeGroup = z.infer<typeof AgeGroupSchema>;

export const TimestampsSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
}

/** Stable, canonical error envelope (§10.4). */
export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

import { z } from 'zod';
import { RatingSchema } from './common.js';

/** Spec §7 view 1 — one child's progression per subdomain over time. */
export const ChildProgressionSchema = z.object({
  childId: z.uuid(),
  points: z.array(
    z.object({
      sessionId: z.uuid(),
      startedAt: z.iso.datetime(),
      domainId: z.uuid(),
      subdomainId: z.uuid(),
      subdomainVersionId: z.uuid(),
      rating: RatingSchema,
    }),
  ),
});
export type ChildProgression = z.infer<typeof ChildProgressionSchema>;

/** Spec §7 view 2 — a child against the kindergarten cohort distribution. */
export const ChildVsGroupSchema = z.object({
  childId: z.uuid(),
  rows: z.array(
    z.object({
      subdomainId: z.uuid(),
      childRating: RatingSchema,
      distribution: z.object({
        PRESENT: z.number().int(),
        PARTIALLY_PRESENT: z.number().int(),
        ABSENT: z.number().int(),
      }),
    }),
  ),
});
export type ChildVsGroup = z.infer<typeof ChildVsGroupSchema>;

/** Spec §7 view 3 — cross-child grouping by strength / difficulty. */
export const CrossChildPatternSchema = z.object({
  subdomainId: z.uuid(),
  strong: z.array(z.uuid()),
  partial: z.array(z.uuid()),
  needsSupport: z.array(z.uuid()),
});
export type CrossChildPattern = z.infer<typeof CrossChildPatternSchema>;

export const ExportFormatSchema = z.enum(['pdf', 'xlsx']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

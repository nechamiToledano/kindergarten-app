import { z } from 'zod';
import { AgeGroupSchema, RatingSchema } from './common.js';

export const ChildSchema = z.object({
  id: z.uuid(),
  kindergartenId: z.uuid(),
  displayName: z.string().min(1).max(80),
  birthDate: z.iso.date(),
  /**
   * M7 §3.2 — uploaded via the existing POST /media/upload (§14.3), optional.
   * The media proxy (§14.3) returns a site-relative path, not an absolute URL,
   * so this only checks for a non-empty string.
   */
  photoUrl: z.string().min(1).nullable().default(null),
  /**
   * M10 §4 — teacher-set follow-up flag. The dashboard's attention panel unions
   * this with a computed concern rule, so a child a teacher is worried about
   * surfaces even when the numbers look unremarkable.
   */
  watch: z.boolean().default(false),
  /** Server-decorated, read-only — derived from birthDate (§10.1). */
  currentAgeGroup: AgeGroupSchema.optional(),
});
export type Child = z.infer<typeof ChildSchema>;

/** kindergartenId is derived from the caller's tenant scope, never the body. */
export const CreateChildSchema = ChildSchema.omit({
  id: true,
  kindergartenId: true,
  currentAgeGroup: true,
}).extend({
  photoUrl: z.string().min(1).nullable().optional(),
  watch: z.boolean().optional(),
});
export type CreateChild = z.infer<typeof CreateChildSchema>;

export const UpdateChildSchema = CreateChildSchema.partial();
export type UpdateChild = z.infer<typeof UpdateChildSchema>;

/**
 * M10 §4 — where a child stands in the screening cycle.
 *
 * Derived on the server from results the caller can already see, so the roster
 * does not have to download every session in the kindergarten to colour a badge.
 */
export const ChildStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'NEEDS_ATTENTION',
  'ON_TRACK',
]);
export type ChildStatus = z.infer<typeof ChildStatusSchema>;

/** One row of the roster: identity plus the screening state behind it. */
export const ChildListItemSchema = ChildSchema.extend({
  currentAgeGroup: AgeGroupSchema,
  status: ChildStatusSchema,
  /** Subdomains assessed / applicable to this child's age band. */
  assessedCount: z.number().int(),
  applicableCount: z.number().int(),
  /** 0–100, share of the applicable catalogue that has a result. */
  coveragePct: z.number().int().min(0).max(100),
  /** 0–100, PRESENT = 100, PARTIALLY_PRESENT = 50, ABSENT = 0, over latest results. */
  scorePct: z.number().int().min(0).max(100),
  lastSessionAt: z.iso.datetime().nullable(),
  openSessionId: z.uuid().nullable(),
});
export type ChildListItem = z.infer<typeof ChildListItemSchema>;

export const ChildListQuerySchema = z.object({
  search: z.string().max(80).optional(),
  ageGroup: AgeGroupSchema.optional(),
  status: ChildStatusSchema.optional(),
  watch: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ChildListQuery = z.infer<typeof ChildListQuerySchema>;

/** Per-domain rollup for one child — the spine of the child workspace. */
export const ChildDomainSummarySchema = z.object({
  domainId: z.uuid(),
  domainName: z.string(),
  domainSlug: z.string(),
  icon: z.string().nullable(),
  present: z.number().int(),
  presentWithSupport: z.number().int(),
  partial: z.number().int(),
  absent: z.number().int(),
  assessed: z.number().int(),
  /** Subdomains in this domain applicable to the child's current age band. */
  applicable: z.number().int(),
  scorePct: z.number().int().min(0).max(100),
});
export type ChildDomainSummary = z.infer<typeof ChildDomainSummarySchema>;

/**
 * The child workspace in one request.
 *
 * Deliberately a single aggregation endpoint: the previous shape would have had
 * the profile screen fetch the child, every session, every result and the whole
 * content catalogue, then compute all of this in the browser.
 */
export const ChildOverviewSchema = z.object({
  child: ChildListItemSchema,
  domains: z.array(ChildDomainSummarySchema),
  /** Weakest and strongest assessed subdomains, already ranked. */
  strengths: z.array(
    z.object({ subdomainId: z.uuid(), subdomainName: z.string(), domainName: z.string() }),
  ),
  gaps: z.array(
    z.object({
      subdomainId: z.uuid(),
      subdomainName: z.string(),
      domainName: z.string(),
      rating: RatingSchema,
      at: z.iso.datetime(),
    }),
  ),
  recentSessions: z.array(
    z.object({
      sessionId: z.uuid(),
      startedAt: z.iso.datetime(),
      completedAt: z.iso.datetime().nullable(),
      abandonedAt: z.iso.datetime().nullable(),
      mode: z.enum(['ASSESSMENT', 'PRACTICE']),
      total: z.number().int(),
      done: z.number().int(),
      present: z.number().int(),
      presentWithSupport: z.number().int(),
      partial: z.number().int(),
      absent: z.number().int(),
    }),
  ),
});
export type ChildOverview = z.infer<typeof ChildOverviewSchema>;

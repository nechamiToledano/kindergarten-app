import { z } from 'zod';
import { RatingSchema } from './common.js';

/** Count of each rating across a cohort, for the "child vs. group" view. */
export const RatingDistributionSchema = z.object({
  PRESENT: z.number().int(),
  PARTIALLY_PRESENT: z.number().int(),
  ABSENT: z.number().int(),
});
export type RatingDistribution = z.infer<typeof RatingDistributionSchema>;

/** Spec §7 view 1 — one child's progression per subdomain over time. */
export const ChildProgressionSchema = z.object({
  childId: z.uuid(),
  childName: z.string(),
  points: z.array(
    z.object({
      sessionId: z.uuid(),
      startedAt: z.iso.datetime(),
      domainId: z.uuid(),
      domainName: z.string(),
      subdomainId: z.uuid(),
      subdomainName: z.string(),
      subdomainVersionId: z.uuid(),
      rating: RatingSchema,
    }),
  ),
});
export type ChildProgression = z.infer<typeof ChildProgressionSchema>;

/** Spec §7 view 2 — a child against the kindergarten cohort distribution. */
export const ChildVsGroupSchema = z.object({
  childId: z.uuid(),
  childName: z.string(),
  rows: z.array(
    z.object({
      subdomainId: z.uuid(),
      subdomainName: z.string(),
      childRating: RatingSchema,
      distribution: RatingDistributionSchema,
    }),
  ),
});
export type ChildVsGroup = z.infer<typeof ChildVsGroupSchema>;

const PatternChildSchema = z.object({ id: z.uuid(), displayName: z.string() });

/** Spec §7 view 3 — cross-child grouping by strength / difficulty. */
export const CrossChildPatternSchema = z.object({
  subdomainId: z.uuid(),
  subdomainName: z.string(),
  strong: z.array(PatternChildSchema),
  partial: z.array(PatternChildSchema),
  needsSupport: z.array(PatternChildSchema),
});
export type CrossChildPattern = z.infer<typeof CrossChildPatternSchema>;

/** Subdomains with at least one recorded result in this tenant — drives report pickers. */
export const ReportSubdomainSchema = z.object({
  subdomainId: z.uuid(),
  subdomainName: z.string(),
  domainName: z.string(),
  resultCount: z.number().int(),
});
export type ReportSubdomain = z.infer<typeof ReportSubdomainSchema>;

export const ExportFormatSchema = z.enum(['pdf', 'xlsx']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/** M7 §3.1 — the home-dashboard summary. Reads existing data; no new logic. */
export const RecentSessionSchema = z.object({
  sessionId: z.uuid(),
  childId: z.uuid(),
  childName: z.string(),
  domainName: z.string().nullable(),
  startedAt: z.iso.datetime(),
  rating: RatingSchema.nullable(),
});
export type RecentSession = z.infer<typeof RecentSessionSchema>;

export const KindergartenSummarySchema = z.object({
  childrenCount: z.number().int(),
  sessionsThisWeek: z.number().int(),
  diagnosedPctThisMonth: z.number().int().min(0).max(100),
  /** The subdomain with the most ABSENT/PARTIALLY_PRESENT ratings this month, if any. */
  topChallengeDomain: z.string().nullable(),
  recentSessions: z.array(RecentSessionSchema),
});
export type KindergartenSummary = z.infer<typeof KindergartenSummarySchema>;

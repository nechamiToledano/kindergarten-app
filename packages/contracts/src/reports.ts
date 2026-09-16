import { z } from 'zod';
import { AgeGroupSchema, RatingSchema } from './common.js';
import { ChildStatusSchema } from './child.js';
import { SessionModeSchema } from './session.js';

/** Count of each rating across a cohort, for the "child vs. group" view. */
export const RatingDistributionSchema = z.object({
  PRESENT: z.number().int(),
  PRESENT_WITH_SUPPORT: z.number().int(),
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
  /**
   * One score per completed session, so the workspace can draw a trend line
   * without the client re-deriving it from `points` on every render.
   */
  sessionScores: z.array(
    z.object({
      sessionId: z.uuid(),
      startedAt: z.iso.datetime(),
      scorePct: z.number().int().min(0).max(100),
      resultCount: z.number().int(),
    }),
  ),
});
export type ChildProgression = z.infer<typeof ChildProgressionSchema>;

/** Spec §7 view 2 — a child against the kindergarten cohort distribution. */
export const ChildVsGroupSchema = z.object({
  childId: z.uuid(),
  childName: z.string(),
  ageGroup: AgeGroupSchema,
  rows: z.array(
    z.object({
      subdomainId: z.uuid(),
      subdomainName: z.string(),
      domainId: z.uuid(),
      domainName: z.string(),
      childRating: RatingSchema,
      /** 0–100 for the child, and for the rest of their age band. */
      childScorePct: z.number().int().min(0).max(100),
      cohortScorePct: z.number().int().min(0).max(100),
      cohortSize: z.number().int(),
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

/** Subdomains with at least one recorded result in this tenant — drives pickers. */
export const ReportSubdomainSchema = z.object({
  subdomainId: z.uuid(),
  subdomainName: z.string(),
  domainName: z.string(),
  resultCount: z.number().int(),
});
export type ReportSubdomain = z.infer<typeof ReportSubdomainSchema>;

export const ExportFormatSchema = z.enum(['pdf', 'xlsx']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const RecentSessionSchema = z.object({
  sessionId: z.uuid(),
  childId: z.uuid(),
  childName: z.string(),
  childPhotoUrl: z.url().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  /** Domains this sitting covered, for the activity line. */
  domainNames: z.array(z.string()),
  present: z.number().int(),
  presentWithSupport: z.number().int(),
  partial: z.number().int(),
  absent: z.number().int(),
});
export type RecentSession = z.infer<typeof RecentSessionSchema>;

/** A child the dashboard wants the teacher to look at, and why. */
export const AttentionItemSchema = z.object({
  childId: z.uuid(),
  childName: z.string(),
  photoUrl: z.url().nullable(),
  ageGroup: AgeGroupSchema,
  status: ChildStatusSchema,
  /** Machine-readable cause, so the UI phrases it rather than echoing prose. */
  reason: z.enum(['WATCH_FLAG', 'REPEATED_DIFFICULTY']),
  absentCount: z.number().int(),
  assessedCount: z.number().int(),
});
export type AttentionItem = z.infer<typeof AttentionItemSchema>;

/**
 * A sitting that was started and never completed or abandoned — the dashboard's
 * "pick up where you left off" list. Unlike `openSessionCount`, this carries
 * enough to resume directly: `/run/:sessionId` needs nothing else.
 */
export const OpenSessionSchema = z.object({
  sessionId: z.uuid(),
  childId: z.uuid(),
  childName: z.string(),
  childPhotoUrl: z.url().nullable(),
  startedAt: z.iso.datetime(),
  mode: SessionModeSchema,
  doneCount: z.number().int(),
  totalCount: z.number().int(),
});
export type OpenSession = z.infer<typeof OpenSessionSchema>;

/** Average score per domain across the kindergarten, for the dashboard chart. */
export const DomainCohortScoreSchema = z.object({
  domainId: z.uuid(),
  domainName: z.string(),
  domainSlug: z.string(),
  icon: z.string().nullable(),
  scorePct: z.number().int().min(0).max(100),
  /** How many children contributed — a 100% from one child is not a kindergarten. */
  childCount: z.number().int(),
  resultCount: z.number().int(),
});
export type DomainCohortScore = z.infer<typeof DomainCohortScoreSchema>;

/**
 * M10 §5 — the dashboard in one request.
 *
 * Every figure here is computed from rows the caller's tenant owns. Nothing is
 * a placeholder: if there is no data behind a number, it is zero or null and the
 * UI shows an empty state rather than an invented metric.
 */
export const KindergartenSummarySchema = z.object({
  childrenCount: z.number().int(),
  /** Children with at least one completed assessment session. */
  assessedCount: z.number().int(),
  coveragePct: z.number().int().min(0).max(100),
  sessionsThisWeek: z.number().int(),
  openSessionCount: z.number().int(),
  /** The `openSessionCount` sittings themselves, newest first — capped (§7). */
  openSessions: z.array(OpenSessionSchema),
  attention: z.array(AttentionItemSchema),
  notStarted: z.array(
    z.object({
      childId: z.uuid(),
      childName: z.string(),
      photoUrl: z.url().nullable(),
      ageGroup: AgeGroupSchema,
    }),
  ),
  domains: z.array(DomainCohortScoreSchema),
  recentSessions: z.array(RecentSessionSchema),
});
export type KindergartenSummary = z.infer<typeof KindergartenSummarySchema>;

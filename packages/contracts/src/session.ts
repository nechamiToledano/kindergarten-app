import { z } from 'zod';
import { AgeGroupSchema, RatingSchema } from './common.js';
import { RawAnswerSchema } from './game-config.js';

/**
 * M7 §3.4 — ASSESSMENT is the diagnostic flow (§8). PRACTICE is the free-play
 * mode (§3.3): any subdomain, optionally not written to reports. Every report
 * query filters to ASSESSMENT by default so a practice run never contaminates a
 * real screening statistic.
 */
export const SessionModeSchema = z.enum(['ASSESSMENT', 'PRACTICE']);
export type SessionMode = z.infer<typeof SessionModeSchema>;

/** M10 §2 — the lifecycle of one planned subdomain within a session. */
export const PlanItemStatusSchema = z.enum(['PENDING', 'DONE', 'SKIPPED']);
export type PlanItemStatus = z.infer<typeof PlanItemStatusSchema>;

export const SessionSchema = z.object({
  id: z.uuid(),
  childId: z.uuid(),
  kindergartenId: z.uuid(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  /** Set when a teacher ends a sitting early — distinct from "still open". */
  abandonedAt: z.iso.datetime().nullable(),
  /** Snapshot — a child crosses age bands between sessions (§9.1). */
  ageGroupAtTime: AgeGroupSchema,
  mode: SessionModeSchema,
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionPlanItemSchema = z.object({
  id: z.uuid(),
  subdomainId: z.uuid(),
  subdomainName: z.string(),
  domainId: z.uuid(),
  domainName: z.string(),
  orderIndex: z.number().int().min(0),
  status: PlanItemStatusSchema,
  /** The rating recorded for this item, once it is DONE. */
  rating: RatingSchema.nullable(),
});
export type SessionPlanItem = z.infer<typeof SessionPlanItemSchema>;

/**
 * M10 §2 — a session is planned up front rather than discovered as it runs, so
 * the runner can show "3 of 12", resume an interrupted sitting, and record that
 * something was deliberately skipped rather than merely never reached.
 */
export const CreateSessionSchema = z.object({
  childId: z.uuid(),
  mode: SessionModeSchema.default('ASSESSMENT'),
  /** Subdomain ids, in the order they should be presented. */
  plan: z.array(z.uuid()).min(1).max(60),
});
export type CreateSession = z.infer<typeof CreateSessionSchema>;

/** Everything the runner and the child's session history need, in one response. */
export const SessionDetailSchema = SessionSchema.extend({
  childName: z.string(),
  plan: z.array(SessionPlanItemSchema),
  progress: z.object({
    total: z.number().int(),
    done: z.number().int(),
    skipped: z.number().int(),
    pending: z.number().int(),
  }),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

export const SubdomainResultSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  subdomainId: z.uuid(),
  subdomainVersionId: z.uuid(),
  attemptsCount: z.number().int().min(0).max(3),
  rating: RatingSchema,
  teacherNote: z.string().max(2000).nullable(),
  rawAnswers: z.array(RawAnswerSchema),
});
export type SubdomainResult = z.infer<typeof SubdomainResultSchema>;

/**
 * Submitted from the client outbox (§11.5). `clientId` is a client-generated
 * UUID; the endpoint is idempotent on it, so a retried sync cannot duplicate.
 *
 * M10 §3 — `teacherNote` is no longer gated on three failed attempts. A note is
 * clinical observation; restricting it to the failure branch meant the most
 * useful thing a teacher noticed during a *successful* run had nowhere to go.
 */
export const SubmitResultSchema = z.object({
  clientId: z.uuid(),
  sessionId: z.uuid(),
  subdomainId: z.uuid(),
  subdomainVersionId: z.uuid(),
  attemptsCount: z.number().int().min(0).max(3),
  rating: RatingSchema,
  teacherNote: z.string().max(2000).nullable().default(null),
  rawAnswers: z.array(RawAnswerSchema),
});
export type SubmitResult = z.infer<typeof SubmitResultSchema>;

export const SyncBatchSchema = z.object({
  results: z.array(SubmitResultSchema).min(1).max(100),
});
export type SyncBatch = z.infer<typeof SyncBatchSchema>;

export const SyncBatchResultSchema = z.object({
  accepted: z.array(z.uuid()),
  duplicates: z.array(z.uuid()),
});
export type SyncBatchResult = z.infer<typeof SyncBatchResultSchema>;

/** Marking a planned item as deliberately not run (M10 §2). */
export const SkipPlanItemSchema = z.object({ subdomainId: z.uuid() });
export type SkipPlanItem = z.infer<typeof SkipPlanItemSchema>;

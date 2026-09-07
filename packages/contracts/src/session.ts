import { z } from 'zod';
import { AgeGroupSchema, RatingSchema } from './common.js';
import { RawAnswerSchema } from './game-config.js';

export const SessionSchema = z.object({
  id: z.uuid(),
  childId: z.uuid(),
  kindergartenId: z.uuid(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  /** Snapshot — a child crosses age bands between sessions (§9.1). */
  ageGroupAtTime: AgeGroupSchema,
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = z.object({
  childId: z.uuid(),
});
export type CreateSession = z.infer<typeof CreateSessionSchema>;

export const SubdomainResultSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  subdomainId: z.uuid(),
  subdomainVersionId: z.uuid(),
  attemptsCount: z.number().int().min(0).max(3),
  rating: RatingSchema,
  /** Free text — only permitted on the three-failure branch (§8). */
  teacherNote: z.string().max(2000).nullable(),
  rawAnswers: z.array(RawAnswerSchema),
});
export type SubdomainResult = z.infer<typeof SubdomainResultSchema>;

/**
 * Submitted from the client outbox (§11.5). `clientId` is a client-generated
 * UUID; the endpoint is idempotent on it, so a retried sync cannot duplicate.
 */
export const SubmitResultSchema = z
  .object({
    clientId: z.uuid(),
    sessionId: z.uuid(),
    subdomainId: z.uuid(),
    subdomainVersionId: z.uuid(),
    attemptsCount: z.number().int().min(0).max(3),
    rating: RatingSchema,
    teacherNote: z.string().max(2000).nullable().default(null),
    rawAnswers: z.array(RawAnswerSchema),
  })
  .refine((r) => r.teacherNote === null || r.attemptsCount === 3, {
    message: 'teacherNote is only allowed after three failed attempts',
    path: ['teacherNote'],
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

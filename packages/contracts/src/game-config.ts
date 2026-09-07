import { z } from 'zod';

/**
 * Every game type has a stable id, persisted in the DB, never renamed (§7.1).
 * MVP builds 4.1–4.4 (§7.4); MANUAL_OBSERVATION covers Spec §18.1 q5
 * (physical subdomains with no game — just a rating screen).
 */
export const GameTypeIdSchema = z.enum([
  'BINARY_IMAGE_CHOICE', // Spec §4.1
  'MULTI_IMAGE_CHOICE', // Spec §4.2
  'HOTSPOT_IMAGE', // Spec §4.3
  'DRAG_MATCH', // Spec §4.4
  'MANUAL_OBSERVATION',
]);
export type GameTypeId = z.infer<typeof GameTypeIdSchema>;

export const AssetRefSchema = z.object({
  kind: z.enum(['image', 'audio']),
  url: z.string().min(1),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

const ImageOptionSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().min(1),
  label: z.string().optional(),
});

/** Spec §4.1 — two images, pick the one matching the prompt. */
export const BinaryImageChoiceConfigSchema = z.object({
  gameType: z.literal('BINARY_IMAGE_CHOICE'),
  promptAudioUrl: z.string().min(1),
  options: z.tuple([ImageOptionSchema, ImageOptionSchema]),
  correctOptionId: z.string().min(1),
});

/** Spec §4.2 — 3–6 images, pick the correct one(s). */
export const MultiImageChoiceConfigSchema = z.object({
  gameType: z.literal('MULTI_IMAGE_CHOICE'),
  promptAudioUrl: z.string().min(1),
  options: z.array(ImageOptionSchema).min(3).max(6),
  correctOptionIds: z.array(z.string().min(1)).min(1),
});

/** Spec §4.3 / §6 — tap a region of one image. Targets are rectangles in 0..1 space. */
export const HotspotImageConfigSchema = z.object({
  gameType: z.literal('HOTSPOT_IMAGE'),
  promptAudioUrl: z.string().min(1),
  imageUrl: z.string().min(1),
  targets: z
    .array(
      z.object({
        id: z.string().min(1),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0).max(1),
        height: z.number().min(0).max(1),
      }),
    )
    .min(1),
  correctTargetIds: z.array(z.string().min(1)).min(1),
});

/** Spec §4.4 — drag each source onto its matching target. */
export const DragMatchConfigSchema = z.object({
  gameType: z.literal('DRAG_MATCH'),
  promptAudioUrl: z.string().min(1),
  pairs: z
    .array(
      z.object({
        sourceId: z.string().min(1),
        sourceImageUrl: z.string().min(1),
        targetId: z.string().min(1),
        targetImageUrl: z.string().min(1),
      }),
    )
    .min(2)
    .max(6),
});

export const ManualObservationConfigSchema = z.object({
  gameType: z.literal('MANUAL_OBSERVATION'),
  observationPrompt: z.string().min(1),
});

export const GameConfigSchema = z.discriminatedUnion('gameType', [
  BinaryImageChoiceConfigSchema,
  MultiImageChoiceConfigSchema,
  HotspotImageConfigSchema,
  DragMatchConfigSchema,
  ManualObservationConfigSchema,
]);
export type GameConfig = z.infer<typeof GameConfigSchema>;

/** One recorded answer attempt, appended to SubdomainResult.rawAnswers (§8, Spec §7). */
export const RawAnswerSchema = z.object({
  attempt: z.number().int().min(1),
  at: z.iso.datetime(),
  value: z.unknown(),
  correct: z.boolean(),
});
export type RawAnswer = z.infer<typeof RawAnswerSchema>;

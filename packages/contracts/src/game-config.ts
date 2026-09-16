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
  'SEQUENTIAL_TAP', // Spec §4.5 — added M5
  'COMPARISON', // Spec §4.6 — added M5
  'PUZZLE', // Spec §4.7 — added M5
  'PATTERN_COPY', // Spec §4.8 — added M5
  'SYLLABLE_COUNT', // Spec §9 (חלוקה להברות) — added M12
  'PATTERN_SEQUENCE', // Spec §9 (מתכונת/רצף) — added M12
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
  /** Played when this option is tapped correctly — an emphasised phoneme ("פ-פ-פ-פרה") rather than the generic success chime. */
  feedbackAudioUrl: z.string().min(1).optional(),
});

/** Spec §4.1 — two images, pick the one matching the prompt. */
export const BinaryImageChoiceConfigSchema = z.object({
  gameType: z.literal('BINARY_IMAGE_CHOICE'),
  promptAudioUrl: z.string().min(1),
  /**
   * Extra clips played in order right after `promptAudioUrl`, for prompts that
   * are a sequence of real sounds rather than a single spoken instruction
   * (e.g. "what did you hear first, the drum or the bell?").
   */
  sequenceAudioUrls: z.array(z.string().min(1)).min(1).optional(),
  options: z.tuple([ImageOptionSchema, ImageOptionSchema]),
  correctOptionId: z.string().min(1),
});

/** Spec §4.2 — 3–6 images, pick the correct one(s). */
export const MultiImageChoiceConfigSchema = z.object({
  gameType: z.literal('MULTI_IMAGE_CHOICE'),
  promptAudioUrl: z.string().min(1),
  /** A reference image shown above the options, for match-to-sample/lotto tasks. */
  sampleImageUrl: z.string().min(1).optional(),
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

/**
 * Spec §4.4 — drag each source onto its matching target.
 *
 * `matchMode` (default `'EXACT'`) — `'EXACT'` requires each source on its
 * declared `targetId` (letter/sound matching, where the pairing itself is the
 * thing being tested). `'BIJECTION'` instead accepts any assignment that fills
 * every target with at most `maxPerTarget` sources and leaves none empty — for
 * one-to-one-correspondence tasks (Spec: "לכל עגלה חפץ") where the targets are
 * interchangeable and only the *count* matters, not which source landed where.
 */
export const DragMatchConfigSchema = z.object({
  gameType: z.literal('DRAG_MATCH'),
  promptAudioUrl: z.string().min(1),
  matchMode: z.enum(['EXACT', 'BIJECTION']).default('EXACT'),
  maxPerTarget: z.number().int().min(1).max(4).optional(),
  pairs: z
    .array(
      z.object({
        sourceId: z.string().min(1),
        sourceImageUrl: z.string().min(1),
        /** Real sound for this source, played when the child taps/picks it up (e.g. an animal cry). */
        sourceAudioUrl: z.string().min(1).optional(),
        targetId: z.string().min(1),
        targetImageUrl: z.string().min(1),
      }),
    )
    .min(2)
    .max(6),
});

/**
 * Spec §4.5 — a multi-step audio instruction; the child taps coloured pads in the
 * named order. Pad ids may repeat in the sequence (e.g. red, blue, red).
 */
export const SequentialTapConfigSchema = z.object({
  gameType: z.literal('SEQUENTIAL_TAP'),
  promptAudioUrl: z.string().min(1),
  /** Extra clips chained after promptAudioUrl (e.g. drum, then flute) — same convention as BinaryImageChoiceConfig. */
  sequenceAudioUrls: z.array(z.string().min(1)).min(1).optional(),
  /**
   * Spec: "אם לא לוחץ נכון יהיה אפקט של שגוי ולא יוכל להתקדם" — when true, a tap
   * that doesn't match `correctSequence[taps.length]` is rejected immediately
   * (wrong-feedback, no progress) instead of only being judged at the end.
   */
  validateEachStep: z.boolean().optional(),
  pads: z
    .array(
      z.object({
        id: z.string().min(1),
        color: z.string().min(1),
        label: z.string().optional(),
        /** An image for order-of-object tasks (e.g. which instrument played first). */
        imageUrl: z.string().min(1).optional(),
      }),
    )
    .min(2)
    .max(6),
  correctSequence: z.array(z.string().min(1)).min(2).max(8),
});

/**
 * Spec §4.6 — two items, pick the one that satisfies the criterion. `value` is
 * the quantity/size the scorer compares; for EQUAL the answer is the literal
 * 'EQUAL' rather than an item id.
 */
export const ComparisonTypeSchema = z.enum(['BIGGER', 'SMALLER', 'MORE', 'FEWER', 'EQUAL']);
export const ComparisonConfigSchema = z.object({
  gameType: z.literal('COMPARISON'),
  promptAudioUrl: z.string().min(1),
  comparisonType: ComparisonTypeSchema,
  items: z.tuple([
    z.object({ id: z.string().min(1), imageUrl: z.string().min(1), value: z.number(), label: z.string().optional() }),
    z.object({ id: z.string().min(1), imageUrl: z.string().min(1), value: z.number(), label: z.string().optional() }),
  ]),
});

/**
 * Spec §4.7 — assemble an image from `rows × cols` pieces. `pieceCount` (the grid
 * total) is one of the difficulty steps the spec calls out (2/4/6/8/10). The
 * answer is slot → piece-index; correct when every slot holds its own piece.
 */
const PuzzleObjectSchema = z.object({
  gameType: z.literal('PUZZLE'),
  promptAudioUrl: z.string().min(1),
  imageUrl: z.string().min(1),
  rows: z.number().int().min(1).max(5),
  cols: z.number().int().min(1).max(5),
  pieceCount: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]),
});
/**
 * The cross-field rule (rows × cols === pieceCount) lives on the refined schema
 * the plugin validates with; the discriminated union below needs the plain
 * object, so both are exported.
 */
export const PuzzleConfigSchema = PuzzleObjectSchema.refine(
  (c) => c.rows * c.cols === c.pieceCount,
  { message: 'rows * cols must equal pieceCount', path: ['pieceCount'] },
);

/**
 * Spec §4.8 — odd-one-out: N images share a visual property, one breaks it; tap
 * the different one. Structurally a Multi Image Choice with a comparison intent.
 */
export const PatternCopyConfigSchema = z.object({
  gameType: z.literal('PATTERN_COPY'),
  promptAudioUrl: z.string().min(1),
  options: z.array(ImageOptionSchema).min(3).max(6),
  oddOneOutId: z.string().min(1),
});

/**
 * Spec (חלוקה להברות) — a word image on top, `slotCount` empty squares below
 * (one per syllable), and `tokenCount` identical draggable tokens where
 * `tokenCount > slotCount` — the spec always leaves exactly one decoy
 * unplaced. Correct when exactly `slotCount` tokens have been placed into
 * slots; which token went where doesn't matter, only the count.
 */
const SyllableCountObjectSchema = z.object({
  gameType: z.literal('SYLLABLE_COUNT'),
  promptAudioUrl: z.string().min(1),
  wordImageUrl: z.string().min(1),
  wordAudioUrl: z.string().min(1).optional(),
  slotCount: z.number().int().min(2).max(5),
  tokenCount: z.number().int().min(3).max(6),
});
export const SyllableCountConfigSchema = SyllableCountObjectSchema.refine(
  (c) => c.tokenCount > c.slotCount,
  { message: 'tokenCount must exceed slotCount (at least one decoy token)', path: ['tokenCount'] },
);

/**
 * Spec (מתכונת/רצף) — a visible, read-only sequence prefix (e.g. red, yellow,
 * red, yellow, red) followed by `blankCount` empty slots the child fills from
 * `palette` in order. Correct when the filled blanks equal
 * `correctContinuation` exactly, in order.
 */
const PatternSequenceObjectSchema = z.object({
  gameType: z.literal('PATTERN_SEQUENCE'),
  promptAudioUrl: z.string().min(1),
  palette: z.array(z.object({ id: z.string().min(1), color: z.string().min(1), label: z.string().optional() })).min(2).max(6),
  prefix: z.array(z.string().min(1)).min(2),
  blankCount: z.number().int().min(1).max(8),
  correctContinuation: z.array(z.string().min(1)).min(1).max(8),
});
export const PatternSequenceConfigSchema = PatternSequenceObjectSchema.refine(
  (c) => c.blankCount === c.correctContinuation.length,
  { message: 'blankCount must equal correctContinuation.length', path: ['blankCount'] },
);

export const ManualObservationConfigSchema = z.object({
  gameType: z.literal('MANUAL_OBSERVATION'),
  observationPrompt: z.string().min(1),
});

export const GameConfigSchema = z.discriminatedUnion('gameType', [
  BinaryImageChoiceConfigSchema,
  MultiImageChoiceConfigSchema,
  HotspotImageConfigSchema,
  DragMatchConfigSchema,
  SequentialTapConfigSchema,
  ComparisonConfigSchema,
  PuzzleObjectSchema,
  PatternCopyConfigSchema,
  SyllableCountObjectSchema,
  PatternSequenceObjectSchema,
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

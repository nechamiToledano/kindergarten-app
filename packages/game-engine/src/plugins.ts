import type { z } from 'zod';
import {
  BinaryImageChoiceConfigSchema,
  ComparisonConfigSchema,
  DragMatchConfigSchema,
  HotspotImageConfigSchema,
  ManualObservationConfigSchema,
  MultiImageChoiceConfigSchema,
  PatternCopyConfigSchema,
  PatternSequenceConfigSchema,
  PuzzleConfigSchema,
  SequentialTapConfigSchema,
  SyllableCountConfigSchema,
  type AssetRef,
} from '@kga/contracts';
import type { GamePlugin } from './registry.js';
import { GamePluginRegistry } from './registry.js';

type Infer<S extends z.ZodTypeAny> = z.infer<S>;

const audio = (url: string): AssetRef => ({ kind: 'audio', url });
const image = (url: string): AssetRef => ({ kind: 'image', url });

/** Spec §4.1 */
export const binaryImageChoicePlugin: GamePlugin<Infer<typeof BinaryImageChoiceConfigSchema>> = {
  id: 'BINARY_IMAGE_CHOICE',
  configSchema: BinaryImageChoiceConfigSchema,
  score: (config, answer) => {
    const correct = answer === config.correctOptionId;
    const feedbackAudioUrl = config.options.find((o) => o.id === answer)?.feedbackAudioUrl;
    return { correct, detail: feedbackAudioUrl ? { feedbackAudioUrl } : undefined };
  },
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    ...(config.sequenceAudioUrls ?? []).map(audio),
    ...config.options.flatMap((o) => [
      image(o.imageUrl),
      ...(o.feedbackAudioUrl ? [audio(o.feedbackAudioUrl)] : []),
    ]),
  ],
  meta: {
    label: 'Binary image choice',
    hints: { correctOptionId: 'Must match one of the two option ids' },
  },
};

/** Spec §4.2 — every selected id must be correct and all correct ids selected. */
export const multiImageChoicePlugin: GamePlugin<Infer<typeof MultiImageChoiceConfigSchema>> = {
  id: 'MULTI_IMAGE_CHOICE',
  configSchema: MultiImageChoiceConfigSchema,
  score: (config, answer) => {
    const rawPicked = Array.isArray(answer) ? answer.map(String) : [];
    const picked = [...new Set(rawPicked)].sort();
    const expected = [...new Set(config.correctOptionIds)].sort();
    const correct = picked.length === expected.length && picked.every((id, i) => id === expected[i]);
    const feedbackAudioUrl = correct
      ? config.options.find((o) => rawPicked.includes(o.id))?.feedbackAudioUrl
      : undefined;
    return { correct, detail: feedbackAudioUrl ? { feedbackAudioUrl } : undefined };
  },
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    ...(config.sampleImageUrl ? [image(config.sampleImageUrl)] : []),
    ...config.options.flatMap((o) => [
      image(o.imageUrl),
      ...(o.feedbackAudioUrl ? [audio(o.feedbackAudioUrl)] : []),
    ]),
  ],
  meta: { label: 'Multi image choice', hints: {} },
};

/** Spec §4.3 / §6 — answer is a tapped {x,y} in 0..1 space; hit-test against targets. */
export const hotspotImagePlugin: GamePlugin<Infer<typeof HotspotImageConfigSchema>> = {
  id: 'HOTSPOT_IMAGE',
  configSchema: HotspotImageConfigSchema,
  score: (config, answer) => {
    const point = answer as { x?: number; y?: number } | null;
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      return { correct: false };
    }
    const hit = config.targets.find(
      (t) =>
        point.x! >= t.x &&
        point.x! <= t.x + t.width &&
        point.y! >= t.y &&
        point.y! <= t.y + t.height,
    );
    return { correct: !!hit && config.correctTargetIds.includes(hit.id), detail: { hitId: hit?.id ?? null } };
  },
  assetsOf: (config) => [audio(config.promptAudioUrl), image(config.imageUrl)],
  meta: { label: 'Hotspot image', hints: { targets: 'Rectangles in normalised 0..1 coordinates' } },
};

/** Spec §4.4 — answer is a list of {sourceId,targetId}; all pairs must match. */
export const dragMatchPlugin: GamePlugin<Infer<typeof DragMatchConfigSchema>> = {
  id: 'DRAG_MATCH',
  configSchema: DragMatchConfigSchema,
  score: (config, answer) => {
    const links = Array.isArray(answer)
      ? (answer as Array<{ sourceId: string; targetId: string }>)
      : [];
    if (config.matchMode === 'BIJECTION') {
      const maxPerTarget = config.maxPerTarget ?? 1;
      const sourceIds = new Set(config.pairs.map((p) => p.sourceId));
      const targetIds = new Set(config.pairs.map((p) => p.targetId));
      if (links.length !== config.pairs.length) return { correct: false };
      const usedSources = new Set<string>();
      const perTargetCount = new Map<string, number>();
      for (const link of links) {
        if (!sourceIds.has(link.sourceId) || !targetIds.has(link.targetId)) return { correct: false };
        if (usedSources.has(link.sourceId)) return { correct: false };
        usedSources.add(link.sourceId);
        const count = (perTargetCount.get(link.targetId) ?? 0) + 1;
        if (count > maxPerTarget) return { correct: false };
        perTargetCount.set(link.targetId, count);
      }
      // Every target must receive at least one source — a bijection leaves none empty.
      const correct = [...targetIds].every((id) => (perTargetCount.get(id) ?? 0) >= 1);
      return { correct };
    }
    const expected = new Map(config.pairs.map((p) => [p.sourceId, p.targetId]));
    const correct =
      links.length === expected.size &&
      links.every((l) => expected.get(l.sourceId) === l.targetId);
    return { correct };
  },
  assetsOf: (config) =>
    config.pairs.flatMap((p) => [
      image(p.sourceImageUrl),
      image(p.targetImageUrl),
      ...(p.sourceAudioUrl ? [audio(p.sourceAudioUrl)] : []),
    ]),
  meta: { label: 'Drag to match', hints: {} },
};

/** Spec §4.5 — answer is the ordered list of tapped pad ids; must equal correctSequence. */
export const sequentialTapPlugin: GamePlugin<Infer<typeof SequentialTapConfigSchema>> = {
  id: 'SEQUENTIAL_TAP',
  configSchema: SequentialTapConfigSchema,
  score: (config, answer) => {
    const taps = Array.isArray(answer) ? answer.map(String) : [];
    const expected = config.correctSequence;
    return {
      correct: taps.length === expected.length && taps.every((t, i) => t === expected[i]),
    };
  },
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    ...(config.sequenceAudioUrls ?? []).map(audio),
    ...config.pads.flatMap((p) => (p.imageUrl ? [image(p.imageUrl)] : [])),
  ],
  meta: {
    label: 'Sequential tap',
    hints: { correctSequence: 'Pad ids in order; a pad id may repeat' },
  },
};

/** Spec §4.6 — answer is an item id, or the literal 'EQUAL' for the EQUAL criterion. */
export const comparisonPlugin: GamePlugin<Infer<typeof ComparisonConfigSchema>> = {
  id: 'COMPARISON',
  configSchema: ComparisonConfigSchema,
  score: (config, answer) => {
    const [a, b] = config.items;
    const pick = String(answer);
    switch (config.comparisonType) {
      case 'BIGGER':
      case 'MORE': {
        if (a.value === b.value) return { correct: false };
        return { correct: pick === (a.value > b.value ? a.id : b.id) };
      }
      case 'SMALLER':
      case 'FEWER': {
        if (a.value === b.value) return { correct: false };
        return { correct: pick === (a.value < b.value ? a.id : b.id) };
      }
      case 'EQUAL': {
        // Spec: an EQUAL trial can itself be an equal pair or a decoy unequal
        // pair ("ובשווה יהיה צמד של שווים וצמד של לא שווים") — when unequal,
        // the correct answer is picking the larger group, not the 'EQUAL' button.
        if (a.value === b.value) return { correct: pick === 'EQUAL' };
        return { correct: pick === (a.value > b.value ? a.id : b.id) };
      }
      default:
        return { correct: false };
    }
  },
  assetsOf: (config) => [audio(config.promptAudioUrl), ...config.items.map((i) => image(i.imageUrl))],
  meta: { label: 'Comparison', hints: { comparisonType: 'BIGGER / SMALLER / MORE / FEWER / EQUAL' } },
};

/** Spec §4.7 — answer is slot→piece index; correct when every slot holds its own piece. */
export const puzzlePlugin: GamePlugin<Infer<typeof PuzzleConfigSchema>> = {
  id: 'PUZZLE',
  configSchema: PuzzleConfigSchema as unknown as GamePlugin<Infer<typeof PuzzleConfigSchema>>['configSchema'],
  score: (config, answer) => {
    const placed = Array.isArray(answer) ? answer.map(Number) : [];
    return {
      correct:
        placed.length === config.pieceCount && placed.every((piece, slot) => piece === slot),
    };
  },
  assetsOf: (config) => [audio(config.promptAudioUrl), image(config.imageUrl)],
  meta: { label: 'Puzzle', hints: { pieceCount: 'Must equal rows × cols (2/4/6/8/10)' } },
};

/** Spec §4.8 — odd-one-out; answer is the id of the image that breaks the pattern. */
export const patternCopyPlugin: GamePlugin<Infer<typeof PatternCopyConfigSchema>> = {
  id: 'PATTERN_COPY',
  configSchema: PatternCopyConfigSchema,
  score: (config, answer) => ({ correct: String(answer) === config.oddOneOutId }),
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    ...config.options.map((o) => image(o.imageUrl)),
  ],
  meta: { label: 'Odd one out', hints: { oddOneOutId: 'Must match one of the option ids' } },
};

/**
 * Spec (חלוקה להברות) — answer is the list of slot ids that received a token;
 * correct when exactly `slotCount` slots are filled (which token went where,
 * and which of the extra `tokenCount - slotCount` tokens was left over,
 * doesn't matter — only the count of filled slots is scored).
 */
export const syllableCountPlugin: GamePlugin<Infer<typeof SyllableCountConfigSchema>> = {
  id: 'SYLLABLE_COUNT',
  configSchema: SyllableCountConfigSchema,
  score: (config, answer) => {
    const filledSlots = Array.isArray(answer) ? new Set(answer.map(String)) : new Set();
    return { correct: filledSlots.size === config.slotCount };
  },
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    image(config.wordImageUrl),
    ...(config.wordAudioUrl ? [audio(config.wordAudioUrl)] : []),
  ],
  meta: {
    label: 'Syllable count',
    hints: { slotCount: 'Number of syllables; tokenCount must exceed it by the decoy count' },
  },
};

/**
 * Spec (מתכונת/רצף) — answer is the ordered list of palette ids placed into
 * the blanks after the visible prefix; correct on an exact ordered match
 * against `correctContinuation`.
 */
export const patternSequencePlugin: GamePlugin<Infer<typeof PatternSequenceConfigSchema>> = {
  id: 'PATTERN_SEQUENCE',
  configSchema: PatternSequenceConfigSchema,
  score: (config, answer) => {
    const filled = Array.isArray(answer) ? answer.map(String) : [];
    const expected = config.correctContinuation;
    return {
      correct: filled.length === expected.length && filled.every((id, i) => id === expected[i]),
    };
  },
  assetsOf: (config) => [audio(config.promptAudioUrl)],
  meta: {
    label: 'Pattern sequence',
    hints: { correctContinuation: 'Palette ids continuing the visible prefix, in order' },
  },
};

/** Physical / observation-only subdomains (Spec §18.1 q5) — no game, always "correct". */
export const manualObservationPlugin: GamePlugin<Infer<typeof ManualObservationConfigSchema>> = {
  id: 'MANUAL_OBSERVATION',
  configSchema: ManualObservationConfigSchema,
  score: () => ({ correct: true }),
  assetsOf: () => [],
  meta: { label: 'Manual observation', hints: {} },
};

export const GAME_PLUGINS: GamePlugin[] = [
  binaryImageChoicePlugin as GamePlugin,
  multiImageChoicePlugin as GamePlugin,
  hotspotImagePlugin as GamePlugin,
  dragMatchPlugin as GamePlugin,
  sequentialTapPlugin as GamePlugin,
  comparisonPlugin as GamePlugin,
  puzzlePlugin as GamePlugin,
  patternCopyPlugin as GamePlugin,
  syllableCountPlugin as GamePlugin,
  patternSequencePlugin as GamePlugin,
  manualObservationPlugin as GamePlugin,
];

export function createDefaultRegistry(): GamePluginRegistry {
  const registry = new GamePluginRegistry();
  for (const plugin of GAME_PLUGINS) registry.register(plugin);
  return registry;
}

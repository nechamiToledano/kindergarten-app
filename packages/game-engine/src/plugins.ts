import type { z } from 'zod';
import {
  BinaryImageChoiceConfigSchema,
  DragMatchConfigSchema,
  HotspotImageConfigSchema,
  ManualObservationConfigSchema,
  MultiImageChoiceConfigSchema,
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
  score: (config, answer) => ({ correct: answer === config.correctOptionId }),
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    ...config.options.map((o) => image(o.imageUrl)),
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
    const picked = Array.isArray(answer) ? [...new Set(answer.map(String))].sort() : [];
    const expected = [...new Set(config.correctOptionIds)].sort();
    return {
      correct:
        picked.length === expected.length && picked.every((id, i) => id === expected[i]),
    };
  },
  assetsOf: (config) => [
    audio(config.promptAudioUrl),
    ...config.options.map((o) => image(o.imageUrl)),
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
    const expected = new Map(config.pairs.map((p) => [p.sourceId, p.targetId]));
    const correct =
      links.length === expected.size &&
      links.every((l) => expected.get(l.sourceId) === l.targetId);
    return { correct };
  },
  assetsOf: (config) =>
    config.pairs.flatMap((p) => [image(p.sourceImageUrl), image(p.targetImageUrl)]),
  meta: { label: 'Drag to match', hints: {} },
};

/** Physical / observation-only subdomains (Spec §18.1 q5) — no game, always "correct". */
export const manualObservationPlugin: GamePlugin<Infer<typeof ManualObservationConfigSchema>> = {
  id: 'MANUAL_OBSERVATION',
  configSchema: ManualObservationConfigSchema,
  score: () => ({ correct: true }),
  assetsOf: () => [],
  meta: { label: 'Manual observation', hints: {} },
};

export const MVP_PLUGINS: GamePlugin[] = [
  binaryImageChoicePlugin as GamePlugin,
  multiImageChoicePlugin as GamePlugin,
  hotspotImagePlugin as GamePlugin,
  dragMatchPlugin as GamePlugin,
  manualObservationPlugin as GamePlugin,
];

export function createDefaultRegistry(): GamePluginRegistry {
  const registry = new GamePluginRegistry();
  for (const plugin of MVP_PLUGINS) registry.register(plugin);
  return registry;
}

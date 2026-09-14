import type { GameTypeId } from '@kga/contracts';
import { createDefaultRegistry } from '@kga/game-engine';
import type { GameComponent } from './types';
import { BinaryImageChoice } from './binary-image-choice/BinaryImageChoice';
import { MultiImageChoice } from './multi-image-choice/MultiImageChoice';
import { HotspotImage } from './hotspot-image/HotspotImage';
import { DragMatch } from './drag-match/DragMatch';
import { SequentialTap } from './sequential-tap/SequentialTap';
import { Comparison } from './comparison/Comparison';
import { Puzzle } from './puzzle/Puzzle';
import { PatternCopy } from './pattern-copy/PatternCopy';
import { ManualObservation } from './manual-observation/ManualObservation';

/**
 * §7.3 — adding game type #N is: a plugin in packages/game-engine, a component
 * here, and one line in this map. Nothing else in the app changes.
 */
export const gameComponents: Record<GameTypeId, GameComponent> = {
  BINARY_IMAGE_CHOICE: BinaryImageChoice as GameComponent,
  MULTI_IMAGE_CHOICE: MultiImageChoice as GameComponent,
  HOTSPOT_IMAGE: HotspotImage as GameComponent,
  DRAG_MATCH: DragMatch as GameComponent,
  SEQUENTIAL_TAP: SequentialTap as GameComponent,
  COMPARISON: Comparison as GameComponent,
  PUZZLE: Puzzle as GameComponent,
  PATTERN_COPY: PatternCopy as GameComponent,
  MANUAL_OBSERVATION: ManualObservation as GameComponent,
};

/** The pure side of the registry — schemas, scorers, asset lists (§7.1). */
export const engineRegistry = createDefaultRegistry();

import type { ComponentType } from 'react';
import type { GameConfig } from '@kga/contracts';

/**
 * §7 — the React component for a game type lives in apps/web, keyed by the same
 * stable `gameType` id as its pure plugin in packages/game-engine. This file is
 * the web-side half of the registry; scoring, asset lists and schemas stay in
 * the framework-free package.
 */
export interface GameComponentProps<C extends GameConfig = GameConfig> {
  config: C;
  /** Locked while feedback is shown or audio is still playing. */
  disabled: boolean;
  /** The spoken instruction is still playing; the board is already live, but self-narrating games wait for it. */
  instructionPlaying?: boolean;
  /** Wrong attempts so far (0 on the first try); the board remounts after each wrong feedback. */
  attempt?: number;
  /** How many clips of the spoken prompt sequence have finished playing so far. */
  promptClipsDone?: number;
  /** The child's answer, in the shape the matching plugin's `score` expects. */
  onAnswer: (value: unknown) => void;
}

export type GameComponent<C extends GameConfig = GameConfig> = ComponentType<GameComponentProps<C>>;

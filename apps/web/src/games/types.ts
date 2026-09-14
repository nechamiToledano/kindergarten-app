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
  /** The child's answer, in the shape the matching plugin's `score` expects. */
  onAnswer: (value: unknown) => void;
}

export type GameComponent<C extends GameConfig = GameConfig> = ComponentType<GameComponentProps<C>>;

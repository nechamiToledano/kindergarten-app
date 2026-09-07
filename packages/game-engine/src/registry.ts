import type { z } from 'zod';
import type { AssetRef, GameConfig, GameTypeId } from '@kga/contracts';

export interface AnswerOutcome {
  correct: boolean;
  /** Optional per-plugin detail, persisted verbatim in rawAnswers. */
  detail?: Record<string, unknown>;
}

export interface GamePluginMeta {
  /** Human-readable label, shown in the admin editor (§14.1). */
  label: string;
  /** Field-level hints keyed by config property. */
  hints: Record<string, string>;
}

/**
 * One interaction pattern from Spec §4. Pure and framework-free (§3.6) —
 * the React component lives beside it in apps/web, keyed by the same id.
 */
export interface GamePlugin<TConfig extends GameConfig = GameConfig> {
  /** Stable identifier, persisted in the DB. Never renamed. */
  readonly id: TConfig['gameType'];
  /** Validates gameConfig. Used by the API on write AND the client on render. */
  readonly configSchema: z.ZodType<TConfig>;
  /** Decides whether a given answer is correct. Pure. */
  readonly score: (config: TConfig, answer: unknown) => AnswerOutcome;
  /** Every asset URL this config needs — drives preloading (§11.4) and validation (§15). */
  readonly assetsOf: (config: TConfig) => AssetRef[];
  readonly meta: GamePluginMeta;
}

export class GamePluginRegistry {
  private readonly plugins = new Map<GameTypeId, GamePlugin>();

  register(plugin: GamePlugin): this {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Game plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin as GamePlugin);
    return this;
  }

  get(id: GameTypeId): GamePlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Unknown game type: ${id}`);
    return plugin;
  }

  has(id: GameTypeId): boolean {
    return this.plugins.has(id);
  }

  all(): GamePlugin[] {
    return [...this.plugins.values()];
  }
}

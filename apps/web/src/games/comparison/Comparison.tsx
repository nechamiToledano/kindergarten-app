import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import type { GameComponentProps } from '../types';
import { ImageCard, OptionGrid } from '../ui';

type Config = Extract<GameConfig, { gameType: 'COMPARISON' }>;

/**
 * Spec §4.6 — two items, pick the one that fits the criterion (bigger / smaller /
 * more / fewer), or "שווה" when they match. Answer: the item id, or 'EQUAL'.
 */
export function Comparison({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <OptionGrid>
        {config.items.map((item) => (
          <ImageCard
            key={item.id}
            src={item.imageUrl}
            label={item.label}
            disabled={disabled}
            onClick={() => onAnswer(item.id)}
          />
        ))}
      </OptionGrid>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer('EQUAL')}
        style={{
          minBlockSize: MIN_TOUCH_TARGET_PX,
          paddingInline: '2rem',
          fontSize: 20,
          fontWeight: 700,
          borderRadius: 16,
          border: '3px solid var(--accent-2)',
          background: 'var(--accent-2-bg)',
          color: 'var(--text-h)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        שווה
      </button>
    </div>
  );
}

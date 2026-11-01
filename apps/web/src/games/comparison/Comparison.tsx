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
  const [a, b] = config.items;
  // Same illustration twice (big/small): draw the lesser `value` smaller, on a shared baseline.
  const sizeCompare =
    (config.comparisonType === 'BIGGER' || config.comparisonType === 'SMALLER') &&
    a.imageUrl === b.imageUrl &&
    a.value !== b.value;
  const scaleOf = (value: number) => (sizeCompare && value < Math.max(a.value, b.value) ? 0.45 : 1);
  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <OptionGrid alignItems={sizeCompare ? 'end' : undefined}>
        {config.items.map((item) => (
          <ImageCard
            key={item.id}
            src={item.imageUrl}
            label={item.label}
            disabled={disabled}
            scale={scaleOf(item.value)}
            onClick={() => onAnswer(item.id)}
          />
        ))}
      </OptionGrid>
      {config.comparisonType === 'EQUAL' && (
      <button
        type="button"
        className="game-tap-pad"
        disabled={disabled}
        onClick={() => onAnswer('EQUAL')}
        style={{
          minBlockSize: MIN_TOUCH_TARGET_PX,
          paddingInline: '2rem',
          fontSize: 20,
          fontWeight: 700,
          borderRadius: 999,
          border: '3px solid var(--accent-2)',
          background: 'var(--accent-2-bg)',
          color: 'var(--text-h)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        שווה
      </button>
      )}
    </div>
  );
}

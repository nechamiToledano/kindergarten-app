import { useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import type { GameComponentProps } from '../types';
import { SubmitButton } from '../ui';

type Config = Extract<GameConfig, { gameType: 'PATTERN_SEQUENCE' }>;

const DOT_SIZE = 'clamp(46px, 10vw, 70px)';

function Dot({ color, outline }: { color: string; outline?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        inlineSize: DOT_SIZE,
        blockSize: DOT_SIZE,
        borderRadius: '50%',
        background: outline ? 'transparent' : color,
        border: outline ? `3px dashed var(--border, #d8d8d8)` : 'none',
      }}
    />
  );
}

/**
 * Spec (מתכונת/רצף) — a visible, read-only pattern (e.g. red-yellow-red-yellow)
 * followed by empty blanks the child continues by tapping palette colours in
 * order. Answer: the ordered list of palette ids tapped into the blanks.
 */
export function PatternSequence({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [filled, setFilled] = useState<string[]>([]);
  const full = filled.length >= config.blankCount;
  const colorOf = (id: string) => config.palette.find((p) => p.id === id)?.color ?? '#ccc';

  const tap = (id: string) => {
    if (disabled || full) return;
    setFilled((cur) => [...cur, id]);
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {config.prefix.map((id, i) => (
          <Dot key={`prefix-${i}`} color={colorOf(id)} />
        ))}
        {Array.from({ length: config.blankCount }, (_, i) => (
          <Dot key={`blank-${i}`} color={filled[i] ? colorOf(filled[i]) : '#fff'} outline={!filled[i]} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {config.palette.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            aria-label={swatch.label ?? swatch.id}
            disabled={disabled || full}
            onClick={() => tap(swatch.id)}
            className="game-tap-pad"
            style={{
              inlineSize: 'clamp(90px, 18vw, 140px)',
              blockSize: 'clamp(90px, 18vw, 140px)',
              minInlineSize: MIN_TOUCH_TARGET_PX,
              minBlockSize: MIN_TOUCH_TARGET_PX,
              background: swatch.color,
              cursor: disabled || full ? 'default' : 'pointer',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          disabled={disabled || filled.length === 0}
          onClick={() => setFilled([])}
          style={{
            minBlockSize: MIN_TOUCH_TARGET_PX,
            paddingInline: '1.5rem',
            fontSize: 18,
            borderRadius: 14,
            border: '2px solid var(--border)',
            background: 'var(--code-bg)',
            cursor: disabled || filled.length === 0 ? 'default' : 'pointer',
          }}
        >
          נקה
        </button>
        <SubmitButton disabled={disabled || !full} onClick={() => onAnswer(filled)}>
          אישור
        </SubmitButton>
      </div>
    </div>
  );
}

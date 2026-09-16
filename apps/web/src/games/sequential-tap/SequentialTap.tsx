import { useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import type { GameComponentProps } from '../types';
import { SubmitButton } from '../ui';

type Config = Extract<GameConfig, { gameType: 'SEQUENTIAL_TAP' }>;

/**
 * Spec §4.5 — the prompt names a sequence of colours; the child taps the pads in
 * that order. Answer: the ordered list of tapped pad ids. A pad may be tapped
 * more than once, so taps just accumulate until the expected length is reached.
 */
export function SequentialTap({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [taps, setTaps] = useState<string[]>([]);
  const full = taps.length >= config.correctSequence.length;

  const tap = (id: string) => {
    if (disabled || full) return;
    setTaps((cur) => [...cur, id]);
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: '1rem', minBlockSize: 44, fontSize: 22, fontWeight: 700 }}>
        {taps.length === 0
          ? '—'
          : taps.map((id, i) => (
              <span key={i}>{config.pads.find((p) => p.id === id)?.label ?? id}</span>
            ))}
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {config.pads.map((pad) => (
          <button
            key={pad.id}
            type="button"
            aria-label={pad.label ?? pad.id}
            disabled={disabled || full}
            onClick={() => tap(pad.id)}
            className="game-tap-pad"
            style={{
              inlineSize: 'clamp(90px, 18vw, 140px)',
              blockSize: 'clamp(90px, 18vw, 140px)',
              minInlineSize: MIN_TOUCH_TARGET_PX,
              minBlockSize: MIN_TOUCH_TARGET_PX,
              background: pad.color,
              cursor: disabled || full ? 'default' : 'pointer',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          disabled={disabled || taps.length === 0}
          onClick={() => setTaps([])}
          style={{
            minBlockSize: MIN_TOUCH_TARGET_PX,
            paddingInline: '1.5rem',
            fontSize: 18,
            borderRadius: 14,
            border: '2px solid var(--border)',
            background: 'var(--code-bg)',
            cursor: disabled || taps.length === 0 ? 'default' : 'pointer',
          }}
        >
          נקה
        </button>
        <SubmitButton disabled={disabled || !full} onClick={() => onAnswer(taps)}>
          אישור
        </SubmitButton>
      </div>
    </div>
  );
}

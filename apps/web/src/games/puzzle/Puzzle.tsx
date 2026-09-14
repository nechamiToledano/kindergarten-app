import { useMemo, useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { SubmitButton } from '../ui';

type Config = Extract<GameConfig, { gameType: 'PUZZLE' }>;

/**
 * Spec §4.7 — assemble the image from its pieces. Tap a piece in the tray, then
 * tap a slot to drop it (tap a filled slot to send it back). Answer: slot → piece
 * index; the puzzle plugin scores it correct when every slot holds its own piece.
 */
function sliceStyle(piece: number, rows: number, cols: number) {
  const row = Math.floor(piece / cols);
  const col = piece % cols;
  return {
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${cols === 1 ? 0 : (col / (cols - 1)) * 100}% ${
      rows === 1 ? 0 : (row / (rows - 1)) * 100
    }%`,
  } as const;
}

export function Puzzle({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const { rows, cols, pieceCount, imageUrl } = config;
  const shuffled = useMemo(() => {
    const order = Array.from({ length: pieceCount }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, [pieceCount]);

  const [placed, setPlaced] = useState<(number | null)[]>(() => Array(pieceCount).fill(null));
  const [selected, setSelected] = useState<number | null>(null);
  const tray = shuffled.filter((p) => !placed.includes(p));
  const complete = placed.every((p) => p !== null);

  const dropInto = (slot: number) => {
    if (disabled) return;
    setPlaced((cur) => {
      const next = [...cur];
      if (next[slot] !== null) {
        next[slot] = null; // tap a filled slot to return the piece
        return next;
      }
      if (selected === null) return cur;
      next[slot] = selected;
      return next;
    });
    setSelected(null);
  };

  const tile = { inlineSize: 96, blockSize: 96, borderRadius: 10, backgroundImage: `url("${imageUrl}")` } as const;

  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 96px)`,
          gap: 2,
          padding: 6,
          background: 'var(--border)',
          borderRadius: 14,
        }}
      >
        {placed.map((piece, slot) => (
          <button
            key={slot}
            type="button"
            aria-label={`משבצת ${slot + 1}`}
            disabled={disabled}
            onClick={() => dropInto(slot)}
            style={{
              ...tile,
              border: 'none',
              background: piece === null ? 'var(--code-bg)' : undefined,
              ...(piece === null ? {} : sliceStyle(piece, rows, cols)),
              cursor: disabled ? 'default' : 'pointer',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {tray.map((piece) => (
          <button
            key={piece}
            type="button"
            aria-label={`חתיכה`}
            disabled={disabled}
            onClick={() => setSelected(piece)}
            style={{
              ...tile,
              ...sliceStyle(piece, rows, cols),
              border: selected === piece ? '4px solid var(--accent-2)' : '4px solid transparent',
              cursor: disabled ? 'default' : 'pointer',
            }}
          />
        ))}
      </div>
      <SubmitButton disabled={disabled || !complete} onClick={() => onAnswer(placed)}>
        אישור
      </SubmitButton>
    </div>
  );
}

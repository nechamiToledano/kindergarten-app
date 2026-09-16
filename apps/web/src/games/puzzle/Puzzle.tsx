import { useMemo, useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { DragGhost, SubmitButton } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'PUZZLE' }>;

/**
 * Spec §4.7 — assemble the image from its pieces. Drag a piece from the tray
 * onto its slot, or tap a piece then tap a slot to drop it (tap a filled slot
 * to send it back) — the tap flow stays as the reliable fallback. Answer:
 * slot → piece index; the puzzle plugin scores it correct when every slot
 * holds its own piece.
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
  const [justLanded, setJustLanded] = useState<number | null>(null);
  const tray = shuffled.filter((p) => !placed.includes(p));
  const complete = placed.every((p) => p !== null);

  const placeInto = (piece: number, slot: number) => {
    setPlaced((cur) => {
      if (cur[slot] !== null) return cur; // slot already taken — drop is rejected
      const next = [...cur];
      next[slot] = piece;
      return next;
    });
    setSelected(null);
    setJustLanded(slot);
    window.setTimeout(() => setJustLanded((cur) => (cur === slot ? null : cur)), 260);
  };

  const dropInto = (slot: number) => {
    if (disabled) return;
    if (placed[slot] !== null) {
      setPlaced((cur) => {
        const next = [...cur];
        next[slot] = null; // tap a filled slot to return the piece
        return next;
      });
      return;
    }
    if (selected === null) return;
    placeInto(selected, slot);
  };

  const { dragging, overZone, getDraggableProps, getDropZoneProps, ghostRef } = useDragDrop({
    disabled,
    onDrop: (pieceId, slotId) => placeInto(Number(pieceId), Number(slotId)),
    onTap: (pieceId) => setSelected((cur) => (cur === Number(pieceId) ? null : Number(pieceId))),
  });

  // Board fits within the play card regardless of piece count — a 6x6 puzzle
  // and a 2x2 puzzle both resolve to a tile size that keeps the whole board
  // on screen without scrolling.
  const tileVar = `clamp(48px, ${Math.floor(560 / cols)}px, 96px)`;
  const tile = { inlineSize: tileVar, blockSize: tileVar, borderRadius: 10, backgroundImage: `url("${imageUrl}")` } as const;

  return (
    // Forced LTR: the piece slicing below is plain left-to-right column math
    // (col = piece % cols), and CSS Grid/flex auto-placement mirrors under the
    // page's dir="rtl" — without this, a child can assemble the picture
    // perfectly and still fail the piece===slot check, because "slot 0" would
    // land on the visual right instead of the left the slice math assumes.
    <div dir="ltr" style={{ display: 'grid', gap: 'clamp(0.75rem, 2vw, 1.5rem)', justifyItems: 'center' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tileVar})`,
          gap: 2,
          padding: 6,
          background: 'var(--border)',
          borderRadius: 14,
        }}
      >
        {placed.map((piece, slot) => {
          const isOver = piece === null && overZone === String(slot);
          return (
            <button
              key={slot}
              type="button"
              aria-label={piece === null ? `משבצת ריקה ${slot + 1}, הקישו כדי להניח כאן חלק` : `משבצת ${slot + 1}, מלאה`}
              disabled={disabled}
              onClick={() => dropInto(slot)}
              className={`is-drop-target${piece === null ? ' game-slot' : ''}${isOver ? ' is-drag-over' : ''}${justLanded === slot ? ' drop-landed' : ''}`}
              {...(piece === null ? getDropZoneProps(String(slot)) : {})}
              style={{
                ...tile,
                minInlineSize: 'unset',
                minBlockSize: 'unset',
                border:
                  piece === null && selected !== null
                    ? '3px dashed var(--play-cool)'
                    : piece === null
                      ? undefined
                      : '3px solid transparent',
                ...(piece === null ? {} : sliceStyle(piece, rows, cols)),
                cursor: disabled ? 'default' : 'pointer',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {tray.map((piece) => {
          const isDraggingThis = dragging?.id === String(piece) && dragging.moved;
          return (
            <button
              key={piece}
              type="button"
              aria-label="חתיכה"
              disabled={disabled}
              className={`is-draggable${isDraggingThis ? ' is-dragging' : ''}`}
              {...getDraggableProps(String(piece), {
                backgroundImage: tile.backgroundImage,
                borderRadius: tile.borderRadius,
                ...sliceStyle(piece, rows, cols),
              })}
              style={{
                ...tile,
                ...sliceStyle(piece, rows, cols),
                border: selected === piece ? '4px solid var(--accent-2)' : '4px solid transparent',
                cursor: disabled ? 'default' : 'grab',
              }}
            />
          );
        })}
      </div>
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
      <SubmitButton disabled={disabled || !complete} onClick={() => onAnswer(placed)}>
        אישור
      </SubmitButton>
    </div>
  );
}

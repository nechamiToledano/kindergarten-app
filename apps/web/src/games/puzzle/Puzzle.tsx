import { useMemo, useState, type CSSProperties } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { DragGhost, SubmitButton } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'PUZZLE' }>;

/**
 * Spec §4.7 — assemble the image from its pieces. The loose pieces wait in a
 * tidy grid with even gaps; the board is flush, so pieces pressed into their
 * places join up into one picture. Drag a piece onto the board, or tap a piece
 * then tap a slot (tap a filled slot to send the piece back) — the tap flow
 * stays as the reliable fallback. Answer: slot → piece index; the puzzle plugin
 * scores it correct when every slot holds its own piece.
 *
 * The source image is assumed square, so a piece is `board / cols` wide and
 * `board / rows` tall — a 2×3 or 1×2 puzzle keeps the picture undistorted.
 */
function sliceStyle(piece: number, rows: number, cols: number): CSSProperties {
  const row = Math.floor(piece / cols);
  const col = piece % cols;
  return {
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${cols === 1 ? 0 : (col / (cols - 1)) * 100}% ${
      rows === 1 ? 0 : (row / (rows - 1)) * 100
    }%`,
  };
}

const TRAY_GAP = 12;
const TRAY_SCALE = 0.8;

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

  const image = { backgroundImage: `url("${imageUrl}")` } as const;
  const tileW = `calc(var(--bw) / ${cols})`;
  const tileH = `calc(var(--bw) / ${rows})`;
  const trayW = `calc(var(--bw) / ${cols} * ${TRAY_SCALE})`;
  const trayH = `calc(var(--bw) / ${rows} * ${TRAY_SCALE})`;

  return (
    // Forced LTR: the piece slicing above is plain left-to-right column math
    // (col = piece % cols), and CSS Grid/flex auto-placement mirrors under the
    // page's dir="rtl" — without this, a child can assemble the picture
    // perfectly and still fail the piece===slot check, because "slot 0" would
    // land on the visual right instead of the left the slice math assumes.
    <div
      dir="ltr"
      style={{
        '--bw': 'clamp(200px, 36vmin, 340px)',
        display: 'grid',
        gap: 'clamp(0.75rem, 2vw, 1.5rem)',
        justifyItems: 'center',
      } as CSSProperties}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 'clamp(1rem, 3vw, 2.5rem)' }}>
        <div
          className={`puzzle-board${complete ? ' is-complete' : ''}`}
          style={{ gridTemplateColumns: `repeat(${cols}, ${tileW})`, gridAutoRows: tileH }}
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
                className={`is-drop-target puzzle-slot${piece === null ? '' : ' is-filled'}${isOver ? ' is-drag-over' : ''}${justLanded === slot ? ' drop-landed' : ''}`}
                {...(piece === null ? getDropZoneProps(String(slot)) : {})}
                style={{
                  ...(piece === null
                    ? selected !== null
                      ? { borderColor: 'var(--play-cool)' }
                      : {}
                    : { ...image, ...sliceStyle(piece, rows, cols) }),
                  cursor: disabled ? 'default' : 'pointer',
                }}
              />
            );
          })}
        </div>
        {tray.length > 0 && (
          <div
            className="puzzle-tray"
            style={{ gridTemplateColumns: `repeat(${cols}, ${trayW})`, gridAutoRows: trayH, gap: TRAY_GAP }}
          >
            {tray.map((piece) => {
              const isDraggingThis = dragging?.id === String(piece) && dragging.moved;
              return (
                <button
                  key={piece}
                  type="button"
                  aria-label="חתיכה"
                  disabled={disabled}
                  className={`is-draggable${isDraggingThis ? ' is-dragging' : ''}`}
                  {...getDraggableProps(String(piece), { ...image, borderRadius: 6, ...sliceStyle(piece, rows, cols) })}
                  style={{
                    ...image,
                    ...sliceStyle(piece, rows, cols),
                    borderRadius: 6,
                    border: selected === piece ? '4px solid var(--accent-2)' : '2px solid var(--play-line-strong)',
                    cursor: disabled ? 'default' : 'grab',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
      <SubmitButton disabled={disabled || !complete} onClick={() => onAnswer(placed)}>
        אישור
      </SubmitButton>
    </div>
  );
}

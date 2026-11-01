import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { DragGhost } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'INSET_PUZZLE' }>;

const SIZE = 'clamp(150px, 30vw, 260px)';
const SEATED_DELAY_MS = 500;

/**
 * Single-piece wooden inset puzzle: one coloured piece, one socket showing its
 * outline. The piece is a transparent PNG and the outline is that same image
 * flattened to a dark shape, so the socket always fits the piece exactly. Drag
 * the piece into the socket, or tap the piece then tap the socket (the tap flow
 * is the reliable fallback on a shared iPad). Seating the piece submits on its
 * own after a beat — a three-year-old shouldn't have to find a confirm button —
 * and tapping the seated piece lifts it back out until then.
 */
export function InsetPuzzle({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [seated, setSeated] = useState(false);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (!seated) return;
    const t = window.setTimeout(() => onAnswer(true), SEATED_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [seated, onAnswer]);

  const seat = () => {
    setSeated(true);
    setSelected(false);
  };

  const { dragging, overZone, getDraggableProps, getDropZoneProps, ghostRef } = useDragDrop({
    disabled: disabled || seated,
    onDrop: seat,
    onTap: () => setSelected((cur) => !cur),
  });

  const art: CSSProperties = {
    backgroundImage: `url("${config.imageUrl}")`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
  const isOver = overZone === 'socket';
  const isDraggingPiece = dragging?.moved === true;

  const { boardUrl, hole } = config;
  if (boardUrl && hole) {
    // Photographed board: the socket is part of the photo, so the piece only has
    // to be stretched over the socket's rectangle once it is seated. The drop
    // target is the socket's rectangle plus a margin, and a quarter overlap is
    // enough, so a rough drop near the socket counts.
    const board = 'clamp(220px, 44vmin, 400px)';
    const ratio = hole.width / hole.height;
    return (
      <div style={{ display: 'grid', gap: 'clamp(1rem, 3vw, 2rem)', justifyItems: 'center' }}>
        <button
          type="button"
          aria-label={seated ? 'החלק במקומו' : 'הלוח, הקישו כדי להניח עליו את החלק'}
          disabled={disabled}
          onClick={() => (seated ? setSeated(false) : selected && seat())}
          className={`is-drop-target inset-board${isOver ? ' is-drag-over' : ''}${seated ? ' drop-landed' : ''}`}
          style={{
            inlineSize: board,
            blockSize: board,
            // Inline so no base button/drop-target rule can reset the sizing:
            // the hole's percentages only line up if the photo fills the box exactly.
            backgroundImage: `url("${boardUrl}")`,
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {!seated && (
            // Invisible target over the socket, a little larger than it: the
            // piece only has to overlap it partly to count as dropped in.
            <span
              aria-hidden
              className={`inset-board-zone${isOver ? ' is-over' : ''}`}
              {...getDropZoneProps('socket')}
              style={{
                insetInlineStart: `${(hole.x - hole.width * 0.1) * 100}%`,
                insetBlockStart: `${(hole.y - hole.height * 0.1) * 100}%`,
                inlineSize: `${hole.width * 120}%`,
                blockSize: `${hole.height * 120}%`,
              }}
            />
          )}
          {seated && (
            <img
              src={config.imageUrl}
              alt=""
              aria-hidden
              className="inset-board-piece"
              style={{
                insetInlineStart: `${hole.x * 100}%`,
                insetBlockStart: `${hole.y * 100}%`,
                inlineSize: `${hole.width * 100}%`,
                blockSize: `${hole.height * 100}%`,
              }}
            />
          )}
        </button>
        {!seated && (
          <button
            type="button"
            aria-label="החלק"
            disabled={disabled}
            className={`is-draggable inset-piece${selected ? ' is-selected' : ''}${isDraggingPiece ? ' is-dragging' : ''}`}
            {...getDraggableProps('piece', { ...art, boxShadow: 'none', filter: 'drop-shadow(0 18px 12px rgba(51, 64, 59, 0.4))' })}
            style={{
              ...art,
              inlineSize: `calc(${board} * ${hole.width})`,
              aspectRatio: `${ratio}`,
              cursor: disabled ? 'default' : 'grab',
            }}
          />
        )}
        <DragGhost dragging={dragging} ghostRef={ghostRef} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'clamp(1rem, 3vw, 2rem)', justifyItems: 'center' }}>
      <button
        type="button"
        aria-label={seated ? 'החלק במקומו' : 'השקע הריק, הקישו כדי להניח כאן את החלק'}
        disabled={disabled}
        onClick={() => (seated ? setSeated(false) : selected && seat())}
        className={`is-drop-target inset-socket${isOver ? ' is-drag-over' : ''}${seated ? ' drop-landed' : ''}`}
        {...(seated ? {} : getDropZoneProps('socket'))}
        style={{ inlineSize: SIZE, blockSize: SIZE }}
      >
        <span
          aria-hidden
          className="inset-socket-art"
          style={{ ...art, ...(seated ? {} : { filter: 'brightness(0) opacity(0.4)' }) }}
        />
      </button>

      {!seated && (
        <button
          type="button"
          aria-label="החלק"
          disabled={disabled}
          className={`is-draggable inset-piece${selected ? ' is-selected' : ''}${isDraggingPiece ? ' is-dragging' : ''}`}
          {...getDraggableProps('piece', { ...art, boxShadow: 'none', filter: 'drop-shadow(0 18px 12px rgba(51, 64, 59, 0.4))' })}
          style={{ ...art, inlineSize: SIZE, blockSize: SIZE, cursor: disabled ? 'default' : 'grab' }}
        />
      )}
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
    </div>
  );
}

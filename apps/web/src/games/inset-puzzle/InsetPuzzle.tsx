import { useEffect, useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { DragGhost } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'INSET_PUZZLE' }>;

const SIZE = 'clamp(150px, 30vw, 260px)';
const SEATED_DELAY_MS = 500;

/**
 * Single-piece wooden inset puzzle: one coloured piece, one socket showing its
 * outline. Drag the piece into the socket, or tap the piece then tap the socket
 * (the tap flow is the reliable fallback on a shared iPad). Seating the piece
 * submits on its own after a beat — a three-year-old shouldn't have to find a
 * confirm button — and tapping the seated piece lifts it back out until then.
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

  const pieceStyle = {
    backgroundImage: `url("${config.imageUrl}")`,
    backgroundSize: 'cover',
    borderRadius: 24,
  } as const;
  const isOver = overZone === 'socket';
  const isDraggingPiece = dragging?.moved === true;

  return (
    <div style={{ display: 'grid', gap: 'clamp(1rem, 3vw, 2rem)', justifyItems: 'center' }}>
      <button
        type="button"
        aria-label={seated ? 'החלק במקומו' : 'השקע הריק, הקישו כדי להניח כאן את החלק'}
        disabled={disabled}
        onClick={() => (seated ? setSeated(false) : selected && seat())}
        className={`is-drop-target inset-socket${isOver ? ' is-drag-over' : ''}${seated ? ' drop-landed' : ''}`}
        {...(seated ? {} : getDropZoneProps('socket'))}
        style={{
          inlineSize: SIZE,
          blockSize: SIZE,
          ...(seated
            ? { ...pieceStyle, border: '4px solid var(--play-cool)' }
            : selected
              ? { borderStyle: 'solid' }
              : {}),
        }}
      >
        {!seated && (
          <img
            src={config.silhouetteUrl}
            alt=""
            draggable={false}
            style={{ inlineSize: '100%', blockSize: '100%', objectFit: 'cover', mixBlendMode: 'multiply', opacity: 0.55, borderRadius: 20, pointerEvents: 'none' }}
          />
        )}
      </button>

      {!seated && (
        <button
          type="button"
          aria-label="החלק"
          disabled={disabled}
          className={`is-draggable${isDraggingPiece ? ' is-dragging' : ''}`}
          {...getDraggableProps('piece', pieceStyle)}
          style={{
            ...pieceStyle,
            inlineSize: SIZE,
            blockSize: SIZE,
            border: selected ? '4px solid var(--accent-2)' : '4px solid transparent',
            cursor: disabled ? 'default' : 'grab',
          }}
        />
      )}
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
    </div>
  );
}

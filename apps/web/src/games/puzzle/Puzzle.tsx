import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';

type Config = Extract<GameConfig, { gameType: 'PUZZLE' }>;
type Offset = { x: number; y: number };

/**
 * Spec §4.7 — assemble the image from its pieces. Every piece starts in the
 * right order, but spread apart with an even gap between neighbours; the child's
 * job is to drag each piece back against the others until the picture closes.
 * A piece let go close to its place snaps in flush and locks; when the last one
 * snaps the answer is sent on its own (slot → piece index, the identity — the
 * puzzle plugin scores it correct when every slot holds its own piece).
 *
 * Offsets are fractions of the board width, so one number describes a piece's
 * displacement at any screen size; the board width itself lives in the CSS
 * variable `--bw`. The source image is assumed square, so a piece is
 * `board / cols` wide and `board / rows` tall and the picture is never stretched.
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

/** Gap between neighbouring pieces at the start, as a fraction of the board. */
const GAP = 0.09;
/** Released within this distance of its place (fraction of the board) → snaps. */
const SNAP = 0.07;
/** A drag shorter than this (fraction of the board) is treated as a tap. */
const MIN_MOVE = 0.015;
const COMPLETE_DELAY_MS = 700;

export function Puzzle({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const { rows, cols, pieceCount, imageUrl } = config;
  const pad = (Math.max(rows, cols) - 1) * (GAP / 2) + 0.06;

  const start = useMemo<Offset[]>(
    () =>
      Array.from({ length: pieceCount }, (_, i) => ({
        x: ((i % cols) - (cols - 1) / 2) * GAP,
        y: (Math.floor(i / cols) - (rows - 1) / 2) * GAP,
      })),
    [pieceCount, rows, cols],
  );

  const [offsets, setOffsets] = useState<Offset[]>(start);
  const [snapped, setSnapped] = useState<boolean[]>(() => Array(pieceCount).fill(false));
  const [held, setHeld] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([]); // most recently touched last, for stacking

  const offsetsRef = useRef(offsets);
  const drag = useRef<{ i: number; px: number; py: number; ox: number; oy: number; bw: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const col = d.i % cols;
      const row = Math.floor(d.i / cols);
      const x = d.ox + (e.clientX - d.px) / d.bw;
      const y = d.oy + (e.clientY - d.py) / d.bw;
      const next = {
        x: Math.min(Math.max(x, -pad - col / cols), 1 + pad - (col + 1) / cols),
        y: Math.min(Math.max(y, -pad - row / rows), 1 + pad - (row + 1) / rows),
      };
      offsetsRef.current = offsetsRef.current.map((o, i) => (i === d.i ? next : o));
      setOffsets(offsetsRef.current);
    };
    const up = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      setHeld(null);
      const cur = offsetsRef.current;
      const o = cur[d.i];
      // A bare tap (piece barely moved) never snaps, so the child has to act.
      if (Math.hypot(o.x - d.ox, o.y - d.oy) < MIN_MOVE) return;
      // Forgiving on purpose: close to its own place, or close to being
      // correctly next to a neighbouring piece, is enough — no precision needed.
      const col = d.i % cols;
      const row = Math.floor(d.i / cols);
      const toSnap = new Set<number>();
      if (Math.hypot(o.x, o.y) <= SNAP) toSnap.add(d.i);
      const neighbours = [
        col > 0 ? d.i - 1 : -1,
        col < cols - 1 ? d.i + 1 : -1,
        row > 0 ? d.i - cols : -1,
        row < rows - 1 ? d.i + cols : -1,
      ];
      for (const j of neighbours) {
        if (j < 0) continue;
        if (Math.hypot(o.x - cur[j].x, o.y - cur[j].y) <= SNAP) {
          toSnap.add(d.i);
          toSnap.add(j);
        }
      }
      if (toSnap.size === 0) return;
      offsetsRef.current = cur.map((c, i) => (toSnap.has(i) ? { x: 0, y: 0 } : c));
      setOffsets(offsetsRef.current);
      setSnapped((s) => s.map((v, i) => v || toSnap.has(i)));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, [rows, cols, pad]);

  const complete = snapped.every(Boolean);
  useEffect(() => {
    if (!complete) return;
    const t = window.setTimeout(() => onAnswer(Array.from({ length: pieceCount }, (_, i) => i)), COMPLETE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [complete, onAnswer, pieceCount]);

  const grab = (i: number) => (e: ReactPointerEvent<HTMLElement>) => {
    if (disabled || snapped[i]) return;
    const bw = stageRef.current?.querySelector('.puzzle-frame')?.getBoundingClientRect().width ?? 300;
    drag.current = { i, px: e.clientX, py: e.clientY, ox: offsets[i].x, oy: offsets[i].y, bw };
    setHeld(i);
    setOrder((cur) => [...cur.filter((p) => p !== i), i]);
  };

  const image = { backgroundImage: `url("${imageUrl}")` } as const;

  return (
    // Forced LTR: the piece slicing above is plain left-to-right column math
    // (col = piece % cols), and absolute `left` offsets are physical anyway —
    // under the page's dir="rtl" a child could still assemble the picture while
    // the slice maths disagrees about which side is "column 0".
    <div
      dir="ltr"
      ref={stageRef}
      className={`puzzle-stage${complete ? ' is-complete' : ''}`}
      style={{
        '--bw': 'clamp(180px, min(40vmin, 54vw), 360px)',
        inlineSize: `calc(var(--bw) * ${1 + 2 * pad})`,
        blockSize: `calc(var(--bw) * ${1 + 2 * pad})`,
      } as CSSProperties}
    >
      <div
        className="puzzle-frame"
        style={{ left: `calc(var(--bw) * ${pad})`, top: `calc(var(--bw) * ${pad})`, inlineSize: 'var(--bw)', blockSize: 'var(--bw)' }}
      />
      {Array.from({ length: pieceCount }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const o = offsets[i];
        return (
          <button
            key={i}
            type="button"
            aria-label={snapped[i] ? 'חלק במקומו' : 'חלק, גררו אותו אל שאר החלקים'}
            disabled={disabled}
            onPointerDown={grab(i)}
            className={`puzzle-piece${snapped[i] ? ' is-snapped' : ''}${held === i ? ' is-held' : ''}`}
            style={{
              ...image,
              ...sliceStyle(i, rows, cols),
              left: `calc(var(--bw) * ${pad + col / cols + o.x})`,
              top: `calc(var(--bw) * ${pad + row / rows + o.y})`,
              inlineSize: `calc(var(--bw) / ${cols})`,
              blockSize: `calc(var(--bw) / ${rows})`,
              zIndex: snapped[i] ? 0 : 1 + order.indexOf(i),
            }}
          />
        );
      })}
    </div>
  );
}

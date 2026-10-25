import type { CSSProperties, ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import type { DraggingItem } from './useDragDrop';

/**
 * Shared child-surface primitives. Full-bleed, chrome-free, ≥80px targets
 * (§11.2, Spec §10). `label` is only used as the image's `alt` text here —
 * today's placeholder art (§18.2) already bakes a sticker-style caption into
 * the SVG itself, so a second HTML caption underneath was pure duplication.
 * When real photographed/illustrated assets land, a visible caption can come
 * back conditionally for those.
 */

export function OptionGrid({ children, gap = 'clamp(1.25rem, 4vw, 3rem)' }: { children: ReactNode; gap?: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(110px, 22vw, 160px), 1fr))',
        gap,
        justifyItems: 'center',
        alignContent: 'center',
        inlineSize: 'min(900px, 90vw)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

/** The one focal "look at this" element of a game (sample image, target…),
 * deliberately larger than the answer cards below it so the child's eye lands
 * on it first. Spacing below separates "the question" from "your choices". */
export function SampleImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', flexShrink: 0, marginBlockEnd: 'clamp(1rem, 4vh, 2.5rem)' }}>
      <img
        src={src}
        alt={alt}
        style={{
          inlineSize: 'clamp(140px, 30vh, 260px)',
          blockSize: 'clamp(140px, 30vh, 260px)',
          objectFit: 'contain',
          padding: 12,
          background: '#fff',
          borderRadius: 24,
          border: '4px solid var(--accent-2, #2f8f5b)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  );
}

export function ImageCard({
  src,
  label,
  selected,
  disabled,
  onClick,
  style,
  className,
  dragProps,
}: {
  src: string;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  style?: CSSProperties;
  /** Extra classes, e.g. `is-draggable` / `is-dragging` from useDragDrop. */
  className?: string;
  /** Spread from `useDragDrop().getDraggableProps(...)` to make the card pick-up-able. */
  dragProps?: Record<string, unknown>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`game-image-card${className ? ` ${className}` : ''}`}
      {...dragProps}
      style={{
        minInlineSize: MIN_TOUCH_TARGET_PX,
        minBlockSize: MIN_TOUCH_TARGET_PX,
        borderColor: selected ? 'var(--accent-2)' : 'transparent',
        opacity: disabled && !selected ? 0.55 : 1,
        ...style,
      }}
    >
      <span className="game-image-card-frame" style={{ inlineSize: 'clamp(90px, min(20vw, 22vh), 200px)', blockSize: 'clamp(90px, min(20vw, 22vh), 200px)' }}>
        <img
          src={src}
          alt={label ?? 'איור למשחק'}
          width={200}
          height={200}
          loading="eager"
          draggable={false}
          style={{ inlineSize: '100%', blockSize: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
        {selected && (
          <span className="game-image-card-check" aria-hidden>
            ✓
          </span>
        )}
      </span>
    </button>
  );
}

/** Follows the pointer while a piece from `useDragDrop` is picked up — the
 * dragged card itself stays put (so layout never jumps) and this floating
 * copy carries the motion. Position after first paint is written straight to
 * this node (via `ghostRef`) on every pointer move, bypassing React, so
 * tracking stays smooth regardless of how much else is on the board.
 *
 * Portaled straight to `document.body`: this is `position: fixed`, but the
 * play card it would otherwise render inside scrolls its own overflow, and
 * browsers clip/scroll a `position: fixed` descendant by an ancestor's
 * `overflow` even though "fixed" is meant to be viewport-relative. Without
 * the portal, dragging a piece past the card's edge made the card think its
 * content had grown and sprouted a scrollbar instead of just showing the
 * ghost where the pointer actually is. */
export function DragGhost({ dragging, ghostRef }: { dragging: DraggingItem | null; ghostRef: Ref<HTMLDivElement> }) {
  if (!dragging || !dragging.moved) return null;
  return createPortal(
    <div
      ref={ghostRef}
      aria-hidden="true"
      className="game-drag-ghost"
      style={{
        left: dragging.x0 - dragging.offsetX,
        top: dragging.y0 - dragging.offsetY,
        width: dragging.width,
        height: dragging.height,
        ...dragging.ghostStyle,
      }}
    />,
    document.body,
  );
}

export function SubmitButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="game-submit-btn">
      {children}
    </button>
  );
}

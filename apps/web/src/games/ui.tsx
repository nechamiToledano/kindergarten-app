import type { CSSProperties, ReactNode } from 'react';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';

/**
 * Shared child-surface primitives. Full-bleed, chrome-free, ≥80px targets
 * (§11.2, Spec §10). `label` is only used as the image's `alt` text here —
 * today's placeholder art (§18.2) already bakes a sticker-style caption into
 * the SVG itself, so a second HTML caption underneath was pure duplication.
 * When real photographed/illustrated assets land, a visible caption can come
 * back conditionally for those.
 */

export function OptionGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1.5rem',
        justifyItems: 'center',
        inlineSize: 'min(900px, 90vw)',
      }}
    >
      {children}
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
}: {
  src: string;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className="game-image-card"
      style={{
        minInlineSize: MIN_TOUCH_TARGET_PX,
        minBlockSize: MIN_TOUCH_TARGET_PX,
        borderColor: selected ? 'var(--accent-2)' : 'transparent',
        opacity: disabled && !selected ? 0.55 : 1,
        ...style,
      }}
    >
      <span className="game-image-card-frame">
        <img src={src} alt={label ?? ''} width={200} height={200} />
        {selected && (
          <span className="game-image-card-check" aria-hidden>
            ✓
          </span>
        )}
      </span>
    </button>
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

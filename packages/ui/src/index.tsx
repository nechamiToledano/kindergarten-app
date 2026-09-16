import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { cn } from './primitives.js';

export * from './primitives.js';
export * from './shell.js';
export * from './icons.js';

/* ==========================================================================
 * The child-facing surface.
 *
 * Everything above is the teacher's product: calm, dense, professional. What
 * follows is the other half — the controls a four-year-old touches. Different
 * rules apply. Targets are enormous, feedback is immediate and physical, and
 * nothing here is shared with the teacher's chrome, because a child tapping the
 * screen must never be able to reach a navigation item.
 * ========================================================================== */

type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

/** Spec §10 — child-surface controls are never smaller than 80px. */
export const MIN_TOUCH_TARGET_PX = 80;

export function TouchTarget({
  children,
  style,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn('touch-manipulation select-none', className)}
      style={{
        minInlineSize: MIN_TOUCH_TARGET_PX,
        minBlockSize: MIN_TOUCH_TARGET_PX,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export type RatingValue = 'PRESENT' | 'PRESENT_WITH_SUPPORT' | 'PARTIALLY_PRESENT' | 'ABSENT';

/**
 * The teacher's rating control.
 *
 * Shown on the same screen the child just played on, so it is sized for a
 * confident adult tap and colour-coded to the rating semantics — but the
 * selected state is also carried by a border and a check, never by colour
 * alone.
 */
export function RatingBar({
  value,
  onChange,
  labels,
}: {
  value: RatingValue | null;
  onChange: (value: RatingValue) => void;
  labels: Record<RatingValue, string>;
}) {
  const options: { value: RatingValue; active: string }[] = [
    { value: 'PRESENT', active: 'border-present bg-present-soft text-present' },
    { value: 'PRESENT_WITH_SUPPORT', active: 'border-support bg-support-soft text-support' },
    { value: 'PARTIALLY_PRESENT', active: 'border-partial bg-partial-soft text-partial' },
    { value: 'ABSENT', active: 'border-absent bg-absent-soft text-absent' },
  ];

  return (
    <div role="radiogroup" className="flex flex-wrap justify-center gap-3">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <TouchTarget
            key={option.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-6 text-lg font-semibold transition-all',
              selected
                ? option.active
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground',
            )}
          >
            {labels[option.value]}
          </TouchTarget>
        );
      })}
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 64,
  label,
}: {
  percent: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = Math.round(size / 9);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone =
    clamped >= 67 ? 'var(--color-present)' : clamped >= 34 ? 'var(--color-partial)' : 'var(--color-absent)';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label ?? `${clamped}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-secondary)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (clamped / 100) * circumference}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 550ms var(--ease-out-soft)' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 3.4}
        fontWeight={600}
        fill="currentColor"
      >
        {clamped}
      </text>
    </svg>
  );
}

const CONFETTI_COLORS = ['#4a8f74', '#d9a441', '#c96a4a', '#5b8fb0', '#7fae8c'];

/** CSS-only celebration for a correct answer. */
export function ConfettiBurst({ pieces = 20 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        left: Math.round((index / pieces) * 100 + (Math.random() * 8 - 4)),
        delay: Math.random() * 150,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [pieces],
  );
  return (
    <div className="confetti-burst" aria-hidden>
      {items.map((item, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              insetInlineStart: `${item.left}%`,
              background: item.color,
              animationDelay: `${item.delay}ms`,
            } as StyleWithVars
          }
        />
      ))}
    </div>
  );
}

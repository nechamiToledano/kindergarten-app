import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Spec §10 — child-surface controls are never smaller than 80px. */
export const MIN_TOUCH_TARGET_PX = 80;

export function TouchTarget({
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
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

export type RatingValue = 'PRESENT' | 'PARTIALLY_PRESENT' | 'ABSENT';

export function RatingBar({
  value,
  onChange,
  labels,
}: {
  value: RatingValue | null;
  onChange: (v: RatingValue) => void;
  labels: Record<RatingValue, string>;
}) {
  const options: RatingValue[] = ['PRESENT', 'PARTIALLY_PRESENT', 'ABSENT'];
  return (
    <div style={{ display: 'flex', gap: '1rem' }} role="radiogroup" dir="rtl">
      {options.map((option) => (
        <TouchTarget
          key={option}
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </TouchTarget>
      ))}
    </div>
  );
}

import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  ErrorInfo,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  OptionHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Children, Component, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronDownIcon } from './icons.js';

/**
 * The design system.
 *
 * Every visual decision in the teacher-facing product is made here, once. The
 * previous arrangement had this package emit bare class names that each app then
 * defined in its own stylesheet, which meant `apps/web` and `apps/admin` could —
 * and did — drift into looking like different products. These components carry
 * their own Tailwind classes, reading the tokens in the consuming app's
 * stylesheet, so there is one definition of a button and no way to fork it.
 *
 * RTL is handled with logical properties (`ms-*`, `pe-*`, `text-start`)
 * throughout. Physical `left`/`right` classes are a bug in this codebase.
 */

export const cn = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/* ── Button ──────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-card',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
  ghost: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
  outline: 'border border-border bg-card text-foreground hover:bg-secondary',
  danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // 44px minimum height everywhere: this is driven by a finger on an iPad, not a
  // mouse, and the child-facing surface raises it further (see TouchTarget).
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-11 px-4 gap-2 rounded-lg',
  lg: 'h-13 px-6 text-lg gap-2.5 rounded-xl',
};

/**
 * The button's classes, without the button.
 *
 * Router links have to look like buttons, and this package must not depend on a
 * router — so the styling is exported on its own and a `<Link>` in the app wears
 * it. That keeps one definition of a primary action instead of a lookalike.
 */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
    'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks interaction without changing the button's width. */
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('rounded-xl border border-border bg-card shadow-card', className)}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('px-5 pb-5', className)} />;
}

/* ── Page chrome ─────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ── Badges & status ─────────────────────────────────────────────────────── */

type BadgeTone = 'neutral' | 'present' | 'support' | 'partial' | 'absent' | 'info' | 'primary';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-secondary text-muted-foreground',
  present: 'bg-present-soft text-present',
  support: 'bg-support-soft text-support',
  partial: 'bg-partial-soft text-partial',
  absent: 'bg-absent-soft text-absent',
  info: 'bg-info-soft text-info',
  primary: 'bg-accent text-accent-foreground',
};

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** A leading dot, for statuses where the colour itself carries meaning. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const dotColor: Record<BadgeTone, string> = {
    neutral: 'bg-muted-foreground',
    present: 'bg-present',
    support: 'bg-support',
    partial: 'bg-partial',
    absent: 'bg-absent',
    info: 'bg-info',
    primary: 'bg-primary',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dotColor[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/**
 * A 0–100 bar whose colour states the finding.
 *
 * The thresholds mirror the rating scale the score is built from: a score of 67
 * is what a child scoring PRESENT on two of three subdomains gets, and 33 is one
 * of three — so the bands are the ratings, not arbitrary cutoffs.
 */
export function ScoreBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const tone = value >= 67 ? 'bg-present' : value >= 34 ? 'bg-partial' : 'bg-absent';
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tone)}
        style={{ inlineSize: `${Math.max(value, 2)}%` }}
      />
    </div>
  );
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * A deterministic tint per name.
 *
 * Kept inside the sage/warm family rather than spread over the full hue circle:
 * a roster of thirty children should read as one list, not a paint chart, and a
 * random saturated hue next to a rating colour reads as if it means something.
 */
function tintOf(name: string): { background: string; color: string } {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = 110 + (hash % 140);
  return {
    background: `oklch(0.93 0.035 ${hue})`,
    color: `oklch(0.4 0.06 ${hue})`,
  };
}

export function Avatar({
  name,
  photoUrl,
  size = 40,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const tint = useMemo(() => tintOf(name), [name]);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold',
        className,
      )}
      style={{
        inlineSize: size,
        blockSize: size,
        fontSize: Math.round(size / 2.6),
        ...(photoUrl ? {} : tint),
      }}
      title={name}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  );
}

/* ── Inputs ──────────────────────────────────────────────────────────────── */

const FIELD_BASE =
  'w-full rounded-lg border border-input bg-card px-3 text-start transition-colors ' +
  'placeholder:text-muted-foreground focus:border-ring focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(FIELD_BASE, 'h-11', className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(FIELD_BASE, 'min-h-24 py-2.5', className)} />;
}

/**
 * A styled dropdown, not a bare `<select>`.
 *
 * The native control's own panel ignores every design token — it renders with
 * the OS's list styling (a system blue highlight, its own font, square
 * corners) no matter what the trigger looks like, which is what made a picker
 * next to a design-system card read as a different product. This renders its
 * own listbox instead, keeping the same props (`value`, `onChange`,
 * `<option>` children) so call sites are unaffected.
 *
 * The panel is portalled to `<body>` and positioned from the trigger's own
 * `getBoundingClientRect`, the same reasoning as `Dialog`: a trigger inside a
 * scrolling dialog body must not have its dropdown clipped by that container.
 * Position is computed in physical `left`/`top` because `getBoundingClientRect`
 * is itself physical — mixing it with logical `insetInlineStart` would place
 * the panel on the wrong side in this RTL app.
 */
export function Select({
  className,
  id,
  value,
  onChange,
  children,
  disabled,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(
    () =>
      Children.toArray(children)
        .filter(
          (child): child is ReactElement<OptionHTMLAttributes<HTMLOptionElement>> =>
            isValidElement(child),
        )
        .map((child) => ({
          value: String(child.props.value ?? ''),
          label: child.props.children,
          disabled: child.props.disabled,
        })),
    [children],
  );

  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const box = triggerRef.current?.getBoundingClientRect();
      if (box) setRect({ top: box.bottom + 4, left: box.left, width: box.width });
    };
    updatePosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange?.({ target: { value: option.value } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(highlighted);
    }
  };

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          FIELD_BASE,
          'flex h-11 cursor-pointer items-center justify-between gap-2 text-start',
          open && 'border-ring',
          className,
        )}
      >
        <span className={cn('truncate', (!selected || selected.value === '') && 'text-muted-foreground')}>
          {selected ? selected.label : ''}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="animate-in fixed z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-float"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => commit(index)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    option.disabled && 'pointer-events-none opacity-50',
                    index === highlighted
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <CheckIcon className="size-4 shrink-0" />}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * A search box with the magnifier on the reading side.
 *
 * The glyph is not mirrored — a magnifier is an object, not a direction — but it
 * sits at the inline start so it leads the text the way it does in LTR.
 */
export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="pointer-events-none absolute inset-y-0 my-auto size-4 text-muted-foreground"
        style={{ insetInlineStart: '0.75rem' }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input type="search" {...rest} className={cn(FIELD_BASE, 'h-11 ps-9')} />
    </div>
  );
}

export function FilterChips<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="group">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary/30 bg-accent text-accent-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm font-medium"
    >
      <span
        className={cn(
          'relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        {/* Logical inset so the knob travels the correct way in RTL. */}
        <span
          className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200"
          style={{ insetInlineStart: checked ? 'calc(100% - 1.375rem)' : '0.125rem' }}
        />
      </span>
      {label}
    </button>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex gap-1 rounded-xl border border-border bg-card p-1 shadow-card',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'h-9 rounded-lg px-3.5 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-secondary',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="tabular ms-1.5 text-xs opacity-70">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          {icon}
        </span>
      )}
      <h3 className="font-medium">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-secondary', className)} aria-hidden />;
}

/**
 * The one place a request failure is rendered.
 *
 * It always offers a retry: a teacher on kindergarten WiFi meets transient
 * failures constantly, and "something went wrong" with no way forward is the
 * difference between a blip and a support call.
 */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-absent-soft px-4 py-3',
        className,
      )}
    >
      <p className="text-sm text-absent">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          נסו שוב
        </Button>
      )}
    </div>
  );
}

/**
 * Last-resort net for a crash React can't render past — a bug in a screen, a
 * shape of server data no branch expects. Without this the whole app goes
 * blank (or shows a dev overlay) on the teacher's iPad. This is the only class
 * component in the design system because error boundaries have no hook form.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl font-semibold">משהו השתבש</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          אירעה שגיאה בלתי צפויה. הנתונים שנשמרו לפני כן בטוחים — רעננו את הדף כדי להמשיך.
        </p>
        <Button onClick={() => window.location.reload()}>רענון הדף</Button>
      </div>
    );
  }
}

/* ── Dialog ──────────────────────────────────────────────────────────────── */

/**
 * A modal that behaves like one: Escape closes it, focus moves inside on open
 * and returns to the trigger on close, and the page behind it stops scrolling.
 * The previous dialogs were a div with a click handler.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portalled to <body>: a trigger inside the shell's header (which has its own
  // backdrop-blur) would otherwise become the containing block for this fixed
  // overlay, clipping the dialog to the header's own bounds.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'animate-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card shadow-float sm:rounded-2xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── Toast ───────────────────────────────────────────────────────────────── */

export function Toast({
  message,
  tone = 'neutral',
  onDone,
}: {
  message: string;
  tone?: 'neutral' | 'present' | 'absent';
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      className={cn(
        'animate-in fixed bottom-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-float',
        tone === 'present' && 'bg-present text-white',
        tone === 'absent' && 'bg-destructive text-destructive-foreground',
        tone === 'neutral' && 'bg-foreground text-background',
      )}
      style={{ insetInlineStart: '50%', transform: 'translateX(-50%)' }}
    >
      {message}
    </div>
  );
}

/* ── Table ───────────────────────────────────────────────────────────────── */

/**
 * Tables scroll inside their own container rather than widening the page — a
 * horizontally scrolling document on a tablet makes the whole shell feel broken.
 */
export function TableScroller({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[42rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={cn(
        'border-b border-border px-3 py-2.5 text-start text-xs font-medium text-muted-foreground',
        className,
      )}
    />
  );
}

export function Td({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={cn('border-b border-border px-3 py-3 align-middle', className)} />;
}

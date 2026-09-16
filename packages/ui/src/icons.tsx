import type { SVGProps } from 'react';

/**
 * The icon set.
 *
 * Inline rather than a dependency: the whole product needs about twenty glyphs,
 * and the shared package staying dependency-free is what lets both apps and the
 * Prisma-seeded domain catalogue reference the same names.
 *
 * None of these are mirrored automatically. An ear, an eye, a calculator read
 * identically in Hebrew; only glyphs that encode direction carry `.flip-rtl`,
 * and that is applied at the call site where the direction actually means
 * something (ChevronNext below is the exception, since it is directional by
 * definition).
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
  className: props.className ?? 'size-5',
});

/**
 * The brand mark — a small rounded house, echoing the product name (תלם,
 * "furrow": a row planted and tended one pass at a time) with a warmer,
 * literal image: a home, a heart in the window, a light over the door.
 *
 * Unlike the rest of the icon set this one does not follow `currentColor` —
 * it is a fixed four-colour mark (see `assets/branding`) so it reads the same
 * wherever it's placed, the way a logo does. Render it directly, without the
 * `bg-primary` badge the old currentColor mark needed for contrast.
 */
export const TelemMark = ({ className, ...rest }: IconProps) => (
  <svg viewBox="0 0 200 200" className={className ?? 'size-5'} aria-hidden {...rest}>
    <path
      d="M100,36 C132,36 168,64 168,97 L168,147 Q168,170 145,170 L55,170 Q32,170 32,147 L32,97 C32,64 68,36 100,36 Z"
      fill="#77CDB5"
    />
    <circle cx="138" cy="54" r="11" fill="#FFD66B" />
    <path
      d="M100,96 C96,90 86,90 84,99 C82,108 92,114 100,122 C108,114 118,108 116,99 C114,90 104,90 100,96 Z"
      fill="#FFF8EE"
    />
    <path d="M84,170 L84,142 Q84,122 100,122 Q116,122 116,142 L116,170 Z" fill="#FF947D" />
  </svg>
);

export const DashboardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const ChildrenIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16.5 6.2a3 3 0 0 1 0 5.6M18 20a5.6 5.6 0 0 0-2.4-4.6" />
  </svg>
);

export const AssessmentIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 3h8a1 1 0 0 1 1 1v1H7V4a1 1 0 0 1 1-1Z" />
    <path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1" />
    <path d="m9 13 2 2 4-4" />
  </svg>
);

export const ReportsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 21h18" />
    <rect x="5" y="11" width="4" height="7" rx="1" />
    <rect x="11" y="6" width="4" height="12" rx="1" />
    <rect x="17" y="14" width="4" height="4" rx="1" />
  </svg>
);

export const LibraryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
    <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" className="flip-rtl" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Directional by definition — always mirrored in RTL. */
export const ChevronNext = (p: IconProps) => (
  <svg {...base(p)} className={`${p.className ?? 'size-4'} flip-rtl`}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/** A dropdown affordance, not a direction — reads the same in both scripts. */
export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16h.01" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 13 4 4 10-10" />
  </svg>
);

export const MinusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 12h12" />
  </svg>
);

export const HalfIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
  </svg>
);

export const FlagIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const TrendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m3 16 5.5-5.5 3.5 3.5L21 5" />
    <path d="M16 5h5v5" />
  </svg>
);

export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5 10.2 12.6 4.5 10.8 10.2 9 12 3.5Z" />
  </svg>
);

export const UsersGroupIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="9" r="3" />
    <circle cx="17" cy="10" r="2.4" />
    <path d="M2.5 19a5.5 5.5 0 0 1 11 0M15 19a4.5 4.5 0 0 1 6.5-4" />
  </svg>
);

/** Domain glyphs, keyed by the `icon` slug stored on the Domain row. */
const DOMAIN_GLYPHS: Record<string, (p: IconProps) => React.ReactElement> = {
  'audio-lines': (p) => (
    <svg {...base(p)}>
      <path d="M3 10v4M7.5 6v12M12 3v18M16.5 7v10M21 10v4" />
    </svg>
  ),
  ear: (p) => (
    <svg {...base(p)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 3-2.2 4-3.4 5.2-1 1-1.1 2-1.1 2.8a2.75 2.75 0 0 1-5.5 0" />
      <path d="M9.5 8a2.5 2.5 0 0 1 5 0" />
    </svg>
  ),
  eye: (p) => (
    <svg {...base(p)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  calculator: (p) => (
    <svg {...base(p)}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
    </svg>
  ),
  'messages-square': (p) => (
    <svg {...base(p)}>
      <path d="M4 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  activity: (p) => (
    <svg {...base(p)}>
      <path d="M3 12h4l2.5-7 5 14L17 12h4" />
    </svg>
  ),
};

/**
 * Renders a domain's glyph, or a neutral placeholder.
 *
 * A domain a content editor creates will have no glyph until one is chosen, and
 * a missing icon must degrade to a dot rather than to a gap that shifts the row.
 */
export function DomainGlyph({ icon, className }: { icon?: string | null; className?: string }) {
  const glyph = icon ? DOMAIN_GLYPHS[icon] : undefined;
  if (!glyph) {
    return (
      <svg {...base({ className })}>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return glyph({ className });
}

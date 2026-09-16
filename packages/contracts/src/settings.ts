import { z } from 'zod';

/**
 * System-wide settings registry (M11 — real management).
 *
 * Every admin-editable knob gets one entry here: a stable `key`, the Zod shape
 * of its `value`, a human description shown in the admin UI, and the default
 * that applies when no row exists yet in `AppSetting`. Adding a new
 * configurable behaviour means adding one entry here plus reading it where the
 * behaviour lives — never a new hardcoded constant.
 */

export const ConcernThresholdSchema = z.object({
  /** A child needs at least this many assessed subdomains before the concern
      ratio is trusted — below it, one bad morning could flag them. */
  minAssessed: z.number().int().min(1).max(50),
  /** Share of (absent + partial×0.5) over assessed that trips NEEDS_ATTENTION. */
  concernRatio: z.number().min(0).max(1),
});
export type ConcernThreshold = z.infer<typeof ConcernThresholdSchema>;

/** Spec §9 age bands, as the two cutoff ages between them (in whole years). */
export const AgeBandsSchema = z
  .object({
    /** Age at which a child moves from AGE_3_4 into AGE_4_5. */
    band2MinAge: z.number().int().min(1).max(10),
    /** Age at which a child moves from AGE_4_5 into AGE_5_6. */
    band3MinAge: z.number().int().min(1).max(12),
  })
  .refine((v) => v.band3MinAge > v.band2MinAge, {
    message: 'band3MinAge must be greater than band2MinAge',
  });
export type AgeBands = z.infer<typeof AgeBandsSchema>;

export const DashboardDisplaySchema = z.object({
  /** "Sessions this week" window, in days. */
  weekWindowDays: z.number().int().min(1).max(90),
  /** Rows shown in the "open sittings" dashboard widget. */
  openSessionsLimit: z.number().int().min(1).max(50),
  /** Rows shown in the "recent sessions" dashboard widget. */
  recentSessionsLimit: z.number().int().min(1).max(50),
});
export type DashboardDisplay = z.infer<typeof DashboardDisplaySchema>;

export const PasswordPolicySchema = z.object({
  minLength: z.number().int().min(6).max(64),
});
export type PasswordPolicy = z.infer<typeof PasswordPolicySchema>;

export const RateLimitConfigSchema = z.object({
  /** Requests allowed per window, per IP. */
  limit: z.number().int().min(1).max(1000),
  windowMs: z.number().int().min(1000).max(3_600_000),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

export const SETTINGS_REGISTRY = {
  'assessment.concernThreshold': {
    schema: ConcernThresholdSchema,
    default: { minAssessed: 3, concernRatio: 0.4 } satisfies ConcernThreshold,
    label: 'סף "טעון תשומת לב"',
    description:
      'כמה תוצאות נדרשות לפני שדפוס נחשב אמין, ואיזה יחס נעדר/חלקי מסמן ילד לתשומת לב.',
  },
  'assessment.ageBands': {
    schema: AgeBandsSchema,
    default: { band2MinAge: 4, band3MinAge: 5 } satisfies AgeBands,
    label: 'חלוקת גיל לקבוצות',
    description: 'מאיזה גיל (בשנים מלאות) עוברים מ־3–4 ל־4–5, ומ־4–5 ל־5–6.',
  },
  'dashboard.display': {
    schema: DashboardDisplaySchema,
    default: { weekWindowDays: 7, openSessionsLimit: 8, recentSessionsLimit: 6 } satisfies DashboardDisplay,
    label: 'תצוגת לוח הבקרה',
    description: 'טווח הימים ל"מפגשים השבוע", וכמה שורות מוצגות בכל רשימת מפגשים.',
  },
  'security.passwordPolicy': {
    schema: PasswordPolicySchema,
    default: { minLength: 8 } satisfies PasswordPolicy,
    label: 'מדיניות סיסמה',
    description: 'אורך מינימלי לסיסמה, לחשבונות צוות חדשים ולאיפוס סיסמה.',
  },
  'security.loginRateLimit': {
    schema: RateLimitConfigSchema,
    default: { limit: 10, windowMs: 60_000 } satisfies RateLimitConfig,
    label: 'הגבלת ניסיונות התחברות',
    description: 'כמה ניסיונות התחברות מותרים לכתובת IP בחלון הזמן, לפני חסימה זמנית.',
  },
  'security.refreshRateLimit': {
    schema: RateLimitConfigSchema,
    default: { limit: 30, windowMs: 60_000 } satisfies RateLimitConfig,
    label: 'הגבלת חידוש חיבור',
    description: 'כמה בקשות חידוש טוקן מותרות לכתובת IP בחלון הזמן.',
  },
} as const;

export type SettingKey = keyof typeof SETTINGS_REGISTRY;

export const SettingKeySchema = z.enum(
  Object.keys(SETTINGS_REGISTRY) as [SettingKey, ...SettingKey[]],
);

export const AppSettingSchema = z.object({
  key: SettingKeySchema,
  value: z.unknown(),
  description: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type AppSetting = z.infer<typeof AppSettingSchema>;

export const UpdateSettingSchema = z.object({ value: z.unknown() });
export type UpdateSetting = z.infer<typeof UpdateSettingSchema>;

/** Validates a raw value against the schema registered for `key`. Throws a ZodError on failure. */
export function parseSettingValue<K extends SettingKey>(
  key: K,
  value: unknown,
): (typeof SETTINGS_REGISTRY)[K]['default'] {
  return SETTINGS_REGISTRY[key].schema.parse(value) as (typeof SETTINGS_REGISTRY)[K]['default'];
}

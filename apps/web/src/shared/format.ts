import type { AgeGroup, ChildStatus, Rating, SubdomainLevel } from '@kga/contracts';

/**
 * Every label and formatter the Hebrew UI needs, in one place.
 *
 * These used to be redeclared in five feature folders, which is how "קיים
 * חלקית" ended up rendered three different ways. A label a teacher reads is
 * part of the product vocabulary, not a local string.
 */

export const RATING_LABELS: Record<Rating, string> = {
  PRESENT: 'קיים',
  PRESENT_WITH_SUPPORT: 'קיים עם תיווך',
  PARTIALLY_PRESENT: 'קיים חלקית',
  ABSENT: 'לא קיים',
};

export const RATING_TONE: Record<Rating, 'present' | 'support' | 'partial' | 'absent'> = {
  PRESENT: 'present',
  PRESENT_WITH_SUPPORT: 'support',
  PARTIALLY_PRESENT: 'partial',
  ABSENT: 'absent',
};

export const RATING_COLOR: Record<Rating, string> = {
  PRESENT: 'var(--color-present)',
  PRESENT_WITH_SUPPORT: 'var(--color-support)',
  PARTIALLY_PRESENT: 'var(--color-partial)',
  ABSENT: 'var(--color-absent)',
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  AGE_3_4: 'גילאי 3–4',
  AGE_4_5: 'גילאי 4–5',
  AGE_5_6: 'גילאי 5–6',
};

export const AGE_GROUP_SHORT: Record<AgeGroup, string> = {
  AGE_3_4: '3–4',
  AGE_4_5: '4–5',
  AGE_5_6: '5–6',
};

export const STATUS_LABELS: Record<ChildStatus, string> = {
  NOT_STARTED: 'טרם החל',
  IN_PROGRESS: 'אבחון פעיל',
  NEEDS_ATTENTION: 'דורש תשומת לב',
  ON_TRACK: 'מתקדם יפה',
};

export const STATUS_TONE: Record<ChildStatus, 'neutral' | 'info' | 'absent' | 'present'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  NEEDS_ATTENTION: 'absent',
  ON_TRACK: 'present',
};

export const LEVEL_LABELS: Record<SubdomainLevel, string> = {
  1: 'בסיסי',
  2: 'מתפתח',
  3: 'מתקדם',
};

export const GAME_TYPE_LABELS: Record<string, string> = {
  BINARY_IMAGE_CHOICE: 'בחירה בין שתי תמונות',
  MULTI_IMAGE_CHOICE: 'בחירה מרובה',
  HOTSPOT_IMAGE: 'איתור בתמונה',
  DRAG_MATCH: 'גרירה והתאמה',
  MANUAL_OBSERVATION: 'תצפית מונחית',
  SEQUENTIAL_TAP: 'הקשה ברצף',
  COMPARISON: 'השוואה',
  PUZZLE: 'פאזל',
  PATTERN_COPY: 'העתקת מתכונת',
};

const HE_MONTHS = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
];

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ב${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

/**
 * "לפני 3 ימים" rather than a date.
 *
 * On an activity feed the useful question is how long ago, not when; the exact
 * timestamp stays available as a `title` wherever this is used.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  if (days < 60) return 'לפני חודש';
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return `לפני ${Math.floor(days / 365)} שנים`;
}

/** A child's age as "4.5", from their birth date. */
export function ageLabel(birthDate: string, now: Date = new Date()): string {
  const born = new Date(birthDate);
  const months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}` : `${years}.${Math.round((rest / 12) * 10)}`;
}

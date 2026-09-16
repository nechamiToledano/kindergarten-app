import type { AgeGroup, Rating } from '@kga/contracts';

/**
 * Kept in sync with `apps/web/src/shared/format.ts` by hand — the export
 * adapter renders server-side and cannot import the web app's module.
 */
export const RATING_LABELS: Record<Rating, string> = {
  PRESENT: 'קיים',
  PARTIALLY_PRESENT: 'קיים חלקית',
  ABSENT: 'לא קיים',
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  AGE_3_4: 'גילאי 3–4',
  AGE_4_5: 'גילאי 4–5',
  AGE_5_6: 'גילאי 5–6',
};

const HE_MONTHS = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
];

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ב${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

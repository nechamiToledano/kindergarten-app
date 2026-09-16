import type { ChildProgression, ChildVsGroup, CrossChildPattern } from '@kga/contracts';
import { AGE_GROUP_LABELS, RATING_LABELS, formatDate } from './report-labels.js';

export interface ReportTable {
  heading?: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportDocument {
  title: string;
  tables: ReportTable[];
}

function isChildProgression(data: unknown): data is ChildProgression {
  return !!data && typeof data === 'object' && 'points' in data && 'sessionScores' in data;
}

function isChildVsGroup(data: unknown): data is ChildVsGroup {
  return !!data && typeof data === 'object' && 'ageGroup' in data && 'rows' in data;
}

function isCrossChildPattern(data: unknown): data is CrossChildPattern {
  return (
    !!data &&
    typeof data === 'object' &&
    'strong' in data &&
    'partial' in data &&
    'needsSupport' in data
  );
}

/**
 * The three report endpoints (§7) each return a differently shaped payload
 * and `ExportPort` is generic over `data: unknown` (§10.3), so the adapter
 * has to recover which report it's rendering structurally rather than being
 * told — this is the one place that happens, shared by the PDF and Excel
 * renderers so neither reimplements the report's column layout.
 */
export function toReportDocument(data: unknown): ReportDocument {
  if (isChildProgression(data)) return progressionDocument(data);
  if (isChildVsGroup(data)) return vsGroupDocument(data);
  if (isCrossChildPattern(data)) return patternsDocument(data);
  return { title: 'דוח', tables: [{ columns: ['נתון'], rows: [[JSON.stringify(data)]] }] };
}

function progressionDocument(data: ChildProgression): ReportDocument {
  return {
    title: `דוח התקדמות — ${data.childName}`,
    tables: [
      {
        heading: 'ציון לפי מפגש',
        columns: ['תאריך', 'ציון (%)', 'מספר תוצאות'],
        rows: data.sessionScores.map((s) => [formatDate(s.startedAt), s.scorePct, s.resultCount]),
      },
      {
        heading: 'תוצאות מפורטות',
        columns: ['תאריך', 'תחום', 'תת-תחום', 'דירוג'],
        rows: data.points.map((p) => [
          formatDate(p.startedAt),
          p.domainName,
          p.subdomainName,
          RATING_LABELS[p.rating],
        ]),
      },
    ],
  };
}

function vsGroupDocument(data: ChildVsGroup): ReportDocument {
  return {
    title: `דוח השוואה לקבוצת גיל — ${data.childName} (${AGE_GROUP_LABELS[data.ageGroup]})`,
    tables: [
      {
        columns: [
          'תחום',
          'תת-תחום',
          'דירוג הילד',
          'ציון הילד (%)',
          'ציון הקבוצה (%)',
          'גודל קבוצה',
        ],
        rows: data.rows.map((r) => [
          r.domainName,
          r.subdomainName,
          RATING_LABELS[r.childRating],
          r.childScorePct,
          r.cohortScorePct,
          r.cohortSize,
        ]),
      },
    ],
  };
}

function patternsDocument(data: CrossChildPattern): ReportDocument {
  const section = (heading: string, children: { displayName: string }[]) => ({
    heading: `${heading} (${children.length})`,
    columns: ['שם הילד'],
    rows: children.map((c) => [c.displayName]),
  });
  return {
    title: `דוח דפוסים — ${data.subdomainName}`,
    tables: [
      section('קיים אצל', data.strong),
      section('קיים חלקית אצל', data.partial),
      section('זקוק לתמיכה', data.needsSupport),
    ],
  };
}

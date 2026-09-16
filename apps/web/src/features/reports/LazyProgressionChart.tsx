import { Suspense, lazy } from 'react';
import type { ChildProgression } from '@kga/contracts';
import { Skeleton } from '@kga/ui';

/**
 * The charting library, loaded only when a chart is actually shown.
 *
 * recharts is by far the heaviest dependency in the bundle, and neither the
 * dashboard nor the roster — the two screens a teacher opens every morning —
 * draws a line chart. Splitting it here keeps it off the critical path for the
 * screens that matter most on a tablet over kindergarten WiFi.
 */
const ProgressionChartImpl = lazy(() =>
  import('./ProgressionChart').then((module) => ({ default: module.ProgressionChart })),
);

export function ProgressionChart({ data }: { data: ChildProgression }) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
      <ProgressionChartImpl data={data} />
    </Suspense>
  );
}

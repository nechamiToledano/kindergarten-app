import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgeGroup, ChildStatus, ConcernThreshold, Rating } from '@kga/contracts';
import { SETTINGS_REGISTRY } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_CONCERN_THRESHOLD = SETTINGS_REGISTRY['assessment.concernThreshold'].default;

/** PRESENT = 1, PRESENT_WITH_SUPPORT = 0.75, PARTIALLY_PRESENT = 0.5, ABSENT = 0 — the only scale in the system. */
export const RATING_SCORE: Record<Rating, number> = {
  PRESENT: 1,
  PRESENT_WITH_SUPPORT: 0.75,
  PARTIALLY_PRESENT: 0.5,
  ABSENT: 0,
};

export const pct = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 100);

export interface LatestResult {
  childId: string;
  subdomainId: string;
  subdomainName: string;
  domainId: string;
  rating: Rating;
  createdAt: Date;
}

export interface ChildSessionStats {
  childId: string;
  lastSessionAt: Date | null;
  openSessionId: string | null;
  completedCount: number;
}

export interface ApplicableCatalogue {
  /** Subdomain ids applicable to the age band, with published content. */
  total: number;
  /** Applicable count per domain id. */
  byDomain: Map<string, number>;
}

/**
 * The read model behind the dashboard, the roster and the child workspace.
 *
 * Every figure the redesign shows — coverage, score, status, "needs attention" —
 * is an aggregate over results. Computing those in the browser would mean
 * shipping every session in the kindergarten to every screen, so they are
 * computed here, in bounded queries, once per request.
 *
 * The heavy reads are raw SQL rather than Prisma queries. "The latest result per
 * child per subdomain" is a `DISTINCT ON`, which the
 * `(childId, subdomainId, createdAt)` index serves directly; expressing it
 * through the query builder would either fetch every result and reduce in Node,
 * or issue one query per child.
 *
 * Raw SQL bypasses the tenant extension, so every method here takes an explicit
 * `kindergartenId` and every query filters on it. That is not optional.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The most recent ASSESSMENT rating for each (child, subdomain) pair.
   *
   * Practice runs are excluded: a child replaying a game for fun must never move
   * a diagnostic figure.
   */
  async latestResults(kindergartenId: string, childIds: string[]): Promise<LatestResult[]> {
    if (childIds.length === 0) return [];
    return this.prisma.$queryRaw<LatestResult[]>`
      SELECT DISTINCT ON (r."childId", r."subdomainId")
        r."childId"      AS "childId",
        r."subdomainId"  AS "subdomainId",
        sd."name"        AS "subdomainName",
        sd."domainId"    AS "domainId",
        r."rating"       AS "rating",
        r."createdAt"    AS "createdAt"
      FROM "SubdomainResult" r
      JOIN "Session" s    ON s."id"  = r."sessionId"
      JOIN "Subdomain" sd ON sd."id" = r."subdomainId"
      WHERE r."kindergartenId" = ${kindergartenId}
        AND r."childId" IN (${Prisma.join(childIds)})
        AND s."mode" = 'ASSESSMENT'
        AND s."deletedAt" IS NULL
      ORDER BY r."childId", r."subdomainId", r."createdAt" DESC`;
  }

  /** Last activity and any still-open sitting, per child. */
  async sessionStats(kindergartenId: string, childIds: string[]): Promise<ChildSessionStats[]> {
    if (childIds.length === 0) return [];
    return this.prisma.$queryRaw<ChildSessionStats[]>`
      SELECT
        s."childId"                                                        AS "childId",
        MAX(s."startedAt")                                                 AS "lastSessionAt",
        MAX(s."id") FILTER (
          WHERE s."completedAt" IS NULL AND s."abandonedAt" IS NULL
        )                                                                  AS "openSessionId",
        COUNT(*) FILTER (WHERE s."completedAt" IS NOT NULL)::int           AS "completedCount"
      FROM "Session" s
      WHERE s."kindergartenId" = ${kindergartenId}
        AND s."childId" IN (${Prisma.join(childIds)})
        AND s."mode" = 'ASSESSMENT'
        AND s."deletedAt" IS NULL
      GROUP BY s."childId"`;
  }

  /**
   * How many subdomains a child of this age band could be assessed on.
   *
   * This is the denominator behind every coverage percentage. It lives in one
   * place so "12 of 18" means the same 18 on the dashboard, the roster and the
   * child workspace — screens that would otherwise each pick their own.
   */
  async applicableCatalogue(ageGroup: AgeGroup): Promise<ApplicableCatalogue> {
    const rows = await this.prisma.$queryRaw<{ domainId: string; count: number }[]>`
      SELECT sd."domainId" AS "domainId", COUNT(*)::int AS "count"
      FROM "Subdomain" sd
      WHERE sd."deletedAt" IS NULL
        AND ${ageGroup}::"AgeGroup" = ANY(sd."ageGroups")
        AND EXISTS (SELECT 1 FROM "SubdomainVersion" v WHERE v."subdomainId" = sd."id")
      GROUP BY sd."domainId"`;

    const byDomain = new Map(rows.map((row) => [row.domainId, row.count]));
    let total = 0;
    for (const row of rows) total += row.count;
    return { total, byDomain };
  }

  /** Applicable catalogues for several age bands at once, keyed by band. */
  async applicableCatalogues(
    ageGroups: AgeGroup[],
  ): Promise<Map<AgeGroup, ApplicableCatalogue>> {
    const unique = [...new Set(ageGroups)];
    const entries = await Promise.all(
      unique.map(async (ageGroup) => [ageGroup, await this.applicableCatalogue(ageGroup)] as const),
    );
    return new Map(entries);
  }

  /**
   * Where a child stands, from their own results.
   *
   * NEEDS_ATTENTION is a judgement, so its rule is written down once here rather
   * than re-invented per screen: a teacher has flagged the child, or enough of
   * their assessed subdomains came back short that the pattern is unlikely to be
   * noise. `threshold` is admin-configurable (M11, `assessment.concernThreshold`
   * in SettingsService) — the caller reads it once per request and passes it
   * in; this method never touches the database, so a threshold read never adds
   * a query per child in a roster loop.
   */
  status(
    input: {
      watch: boolean;
      assessed: number;
      absent: number;
      partial: number;
      presentWithSupport: number;
      hasOpenSession: boolean;
      hasAnySession: boolean;
    },
    threshold: ConcernThreshold = DEFAULT_CONCERN_THRESHOLD,
  ): ChildStatus {
    if (input.watch) return 'NEEDS_ATTENTION';
    if (!input.hasAnySession) return 'NOT_STARTED';
    if (input.assessed >= threshold.minAssessed) {
      const concern =
        (input.absent + input.partial * 0.5 + input.presentWithSupport * 0.25) / input.assessed;
      if (concern >= threshold.concernRatio) return 'NEEDS_ATTENTION';
    }
    if (input.hasOpenSession) return 'IN_PROGRESS';
    if (input.assessed === 0) return 'IN_PROGRESS';
    return 'ON_TRACK';
  }

  /** Tally a child's latest ratings into counts and a 0–100 score. */
  tally(results: { rating: Rating }[]) {
    let present = 0;
    let presentWithSupport = 0;
    let partial = 0;
    let absent = 0;
    let score = 0;
    for (const result of results) {
      if (result.rating === 'PRESENT') present += 1;
      else if (result.rating === 'PRESENT_WITH_SUPPORT') presentWithSupport += 1;
      else if (result.rating === 'PARTIALLY_PRESENT') partial += 1;
      else absent += 1;
      score += RATING_SCORE[result.rating];
    }
    const assessed = results.length;
    return {
      present,
      presentWithSupport,
      partial,
      absent,
      assessed,
      scorePct: assessed === 0 ? 0 : pct(score / assessed),
    };
  }

  /** Group latest results by child id, preserving query order. */
  groupByChild(results: LatestResult[]): Map<string, LatestResult[]> {
    const byChild = new Map<string, LatestResult[]>();
    for (const result of results) {
      const bucket = byChild.get(result.childId);
      if (bucket) bucket.push(result);
      else byChild.set(result.childId, [result]);
    }
    return byChild;
  }
}

@Global()
@Module({ providers: [AnalyticsService], exports: [AnalyticsService] })
export class AnalyticsModule {}

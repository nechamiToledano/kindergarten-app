import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AttentionItem,
  ChildProgression,
  ChildVsGroup,
  CrossChildPattern,
  DomainCohortScore,
  KindergartenSummary,
  OpenSession,
  Principal,
  Rating,
  RecentSession,
  ReportSubdomain,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';
import { CLOCK, ageGroupOf, birthDateRangeFor, type ClockPort } from '../common/clock.js';
import { AnalyticsService, RATING_SCORE, pct } from '../analytics/analytics.service.js';
import { SettingsService } from '../settings/settings.service.js';

const EMPTY_DIST = { PRESENT: 0, PARTIALLY_PRESENT: 0, ABSENT: 0 } as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  private async requireChild(kindergartenId: string, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, kindergartenId, deletedAt: null },
    });
    if (!child) throw new NotFoundException('Child not found');
    return child;
  }

  /** Spec §7 view 1 — one child's progression per subdomain over time. */
  async childProgression(principal: Principal, childId: string): Promise<ChildProgression> {
    const kindergartenId = requireTenant(principal);
    const child = await this.requireChild(kindergartenId, childId);

    const results = await this.prisma.subdomainResult.findMany({
      where: { childId, kindergartenId, session: { deletedAt: null, mode: 'ASSESSMENT' } },
      include: { session: true, subdomain: { include: { domain: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // One score per sitting, so the workspace can draw a trend without the client
    // re-deriving it from every point on each render.
    const bySession = new Map<string, { startedAt: Date; score: number; count: number }>();
    for (const result of results) {
      const bucket = bySession.get(result.sessionId) ?? {
        startedAt: result.session.startedAt,
        score: 0,
        count: 0,
      };
      bucket.score += RATING_SCORE[result.rating as Rating];
      bucket.count += 1;
      bySession.set(result.sessionId, bucket);
    }

    return {
      childId,
      childName: child.displayName,
      points: results.map((r) => ({
        sessionId: r.sessionId,
        startedAt: r.session.startedAt.toISOString(),
        domainId: r.subdomain.domainId,
        domainName: r.subdomain.domain.name,
        subdomainId: r.subdomainId,
        subdomainName: r.subdomain.name,
        subdomainVersionId: r.subdomainVersionId,
        rating: r.rating as Rating,
      })),
      sessionScores: [...bySession]
        .map(([sessionId, bucket]) => ({
          sessionId,
          startedAt: bucket.startedAt.toISOString(),
          scorePct: pct(bucket.score / bucket.count),
          resultCount: bucket.count,
        }))
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    };
  }

  /**
   * Spec §7 view 2 — a child against their cohort.
   *
   * Two corrections. The cohort is now the child's own age band rather than the
   * whole kindergarten: comparing a three-year-old against five-year-olds on the
   * same subdomain produced a gap that said nothing about the child. And the
   * cohort's latest ratings come from one `DISTINCT ON`, where this used to load
   * every result in the kindergarten into memory and reduce it in JavaScript.
   */
  async childVsGroup(principal: Principal, childId: string): Promise<ChildVsGroup> {
    const kindergartenId = requireTenant(principal);
    const child = await this.requireChild(kindergartenId, childId);
    const now = this.clock.now();
    const bands = await this.settings.get('assessment.ageBands');
    const ageGroup = ageGroupOf(child.birthDate, now, bands);

    const cohort = await this.prisma.child.findMany({
      where: {
        kindergartenId,
        deletedAt: null,
        birthDate: birthDateRangeFor(ageGroup, now, bands),
      },
      select: { id: true },
    });
    const cohortIds = cohort.map((row) => row.id);

    const latest = await this.analytics.latestResults(kindergartenId, cohortIds);
    const domains = await this.prisma.domain.findMany({ select: { id: true, name: true } });
    const domainNameById = new Map(domains.map((d) => [d.id, d.name]));

    const distribution = new Map<string, { PRESENT: number; PARTIALLY_PRESENT: number; ABSENT: number }>();
    for (const result of latest) {
      const bucket = distribution.get(result.subdomainId) ?? { ...EMPTY_DIST };
      bucket[result.rating] += 1;
      distribution.set(result.subdomainId, bucket);
    }

    const rows = latest
      .filter((result) => result.childId === childId)
      .map((result) => {
        const dist = distribution.get(result.subdomainId) ?? { ...EMPTY_DIST };
        const cohortSize = dist.PRESENT + dist.PARTIALLY_PRESENT + dist.ABSENT;
        const cohortScore =
          cohortSize === 0
            ? 0
            : (dist.PRESENT + dist.PARTIALLY_PRESENT * 0.5) / cohortSize;
        return {
          subdomainId: result.subdomainId,
          subdomainName: result.subdomainName,
          domainId: result.domainId,
          domainName: domainNameById.get(result.domainId) ?? '',
          childRating: result.rating,
          childScorePct: pct(RATING_SCORE[result.rating]),
          cohortScorePct: pct(cohortScore),
          cohortSize,
          distribution: dist,
        };
      })
      .sort(
        (a, b) =>
          a.domainName.localeCompare(b.domainName, 'he') ||
          a.subdomainName.localeCompare(b.subdomainName, 'he'),
      );

    return { childId, childName: child.displayName, ageGroup, rows };
  }

  /** Spec §7 view 3 — the grouping report. */
  async crossChildPatterns(
    principal: Principal,
    subdomainId: string,
  ): Promise<CrossChildPattern> {
    const kindergartenId = requireTenant(principal);
    const subdomain = await this.prisma.subdomain.findFirst({
      where: { id: subdomainId, deletedAt: null },
    });
    if (!subdomain) throw new NotFoundException('Subdomain not found');

    const children = await this.prisma.child.findMany({
      where: { kindergartenId, deletedAt: null },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(children.map((c) => [c.id, c.displayName]));

    const latest = await this.analytics.latestResults(
      kindergartenId,
      children.map((c) => c.id),
    );

    const strong: { id: string; displayName: string }[] = [];
    const partial: { id: string; displayName: string }[] = [];
    const needsSupport: { id: string; displayName: string }[] = [];
    for (const result of latest) {
      if (result.subdomainId !== subdomainId) continue;
      const entry = { id: result.childId, displayName: nameById.get(result.childId) ?? '' };
      if (result.rating === 'PRESENT') strong.push(entry);
      else if (result.rating === 'PARTIALLY_PRESENT') partial.push(entry);
      else needsSupport.push(entry);
    }

    const byName = (a: { displayName: string }, b: { displayName: string }) =>
      a.displayName.localeCompare(b.displayName, 'he');
    return {
      subdomainId,
      subdomainName: subdomain.name,
      strong: strong.sort(byName),
      partial: partial.sort(byName),
      needsSupport: needsSupport.sort(byName),
    };
  }

  /** Subdomains this tenant has collected results for — the patterns-report picker. */
  async listReportSubdomains(principal: Principal): Promise<ReportSubdomain[]> {
    const kindergartenId = requireTenant(principal);
    const grouped = await this.prisma.subdomainResult.groupBy({
      by: ['subdomainId'],
      where: { kindergartenId, session: { deletedAt: null, mode: 'ASSESSMENT' } },
      _count: { _all: true },
    });
    if (grouped.length === 0) return [];

    const countById = new Map(grouped.map((g) => [g.subdomainId, g._count._all]));
    const subs = await this.prisma.subdomain.findMany({
      where: { id: { in: grouped.map((g) => g.subdomainId) } },
      include: { domain: true },
    });
    return subs
      .map((s) => ({
        subdomainId: s.id,
        subdomainName: s.name,
        domainName: s.domain.name,
        resultCount: countById.get(s.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          a.domainName.localeCompare(b.domainName, 'he') ||
          a.subdomainName.localeCompare(b.subdomainName, 'he'),
      );
  }

  /**
   * M10 §5 — the dashboard.
   *
   * Every figure is a real aggregate over this tenant's rows. Where there is
   * nothing behind a number it is zero or an empty list, and the UI shows an
   * empty state — no invented metric stands in for missing data.
   */
  async kindergartenSummary(principal: Principal): Promise<KindergartenSummary> {
    const kindergartenId = requireTenant(principal);
    const now = this.clock.now();
    const display = await this.settings.get('dashboard.display');
    const weekAgo = new Date(now.getTime() - display.weekWindowDays * 86_400_000);

    const children = await this.prisma.child.findMany({
      where: { kindergartenId, deletedAt: null },
      select: { id: true, displayName: true, birthDate: true, photoUrl: true, watch: true },
      orderBy: { displayName: 'asc' },
    });
    const childIds = children.map((c) => c.id);

    if (childIds.length === 0) {
      return {
        childrenCount: 0,
        assessedCount: 0,
        coveragePct: 0,
        sessionsThisWeek: 0,
        openSessionCount: 0,
        openSessions: [],
        attention: [],
        notStarted: [],
        domains: [],
        recentSessions: [],
      };
    }

    const [
      latest,
      sessionStats,
      sessionsThisWeek,
      openSessionCount,
      openSessions,
      recent,
      domains,
      concernThreshold,
      bands,
    ] = await Promise.all([
      this.analytics.latestResults(kindergartenId, childIds),
      this.analytics.sessionStats(kindergartenId, childIds),
      this.prisma.session.count({
        where: {
          kindergartenId,
          deletedAt: null,
          mode: 'ASSESSMENT',
          startedAt: { gte: weekAgo },
        },
      }),
      this.prisma.session.count({
        where: {
          kindergartenId,
          deletedAt: null,
          mode: 'ASSESSMENT',
          completedAt: null,
          abandonedAt: null,
        },
      }),
      this.openSessions(kindergartenId, display.openSessionsLimit),
      this.recentSessions(kindergartenId, display.recentSessionsLimit),
      this.prisma.domain.findMany({ where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } }),
      this.settings.get('assessment.concernThreshold'),
      this.settings.get('assessment.ageBands'),
    ]);

    const byChild = this.analytics.groupByChild(latest);
    const statsByChild = new Map(sessionStats.map((s) => [s.childId, s]));

    const attention: AttentionItem[] = [];
    const notStarted: KindergartenSummary['notStarted'] = [];

    // Per-domain accumulation, so the cohort chart costs one pass over the same
    // rows rather than a query per domain per child.
    const domainAccum = new Map<string, { score: number; results: number; children: Set<string> }>();

    for (const child of children) {
      const ageGroup = ageGroupOf(child.birthDate, now, bands);
      const results = byChild.get(child.id) ?? [];
      const stats = statsByChild.get(child.id);
      const tally = this.analytics.tally(results);
      const status = this.analytics.status(
        {
          watch: child.watch,
          assessed: tally.assessed,
          absent: tally.absent,
          partial: tally.partial,
          hasOpenSession: !!stats?.openSessionId,
          hasAnySession: !!stats?.lastSessionAt,
        },
        concernThreshold,
      );

      if (status === 'NOT_STARTED') {
        notStarted.push({
          childId: child.id,
          childName: child.displayName,
          photoUrl: child.photoUrl,
          ageGroup,
        });
      }
      if (status === 'NEEDS_ATTENTION') {
        attention.push({
          childId: child.id,
          childName: child.displayName,
          photoUrl: child.photoUrl,
          ageGroup,
          status,
          reason: child.watch ? 'WATCH_FLAG' : 'REPEATED_DIFFICULTY',
          absentCount: tally.absent,
          assessedCount: tally.assessed,
        });
      }

      for (const result of results) {
        const bucket = domainAccum.get(result.domainId) ?? {
          score: 0,
          results: 0,
          children: new Set<string>(),
        };
        bucket.score += RATING_SCORE[result.rating];
        bucket.results += 1;
        bucket.children.add(child.id);
        domainAccum.set(result.domainId, bucket);
      }
    }

    /**
     * "Started an assessment" means the child has at least one recorded rating —
     * not that a session carries a completedAt.
     *
     * Counting completed sessions looked right and behaved badly: a teacher who
     * covered eight subdomains and ended the sitting early left the child
     * counted as untouched, and before the early-end control existed no session
     * was ever marked complete at all, so this figure sat at 0% while the
     * kindergarten had real results in it.
     */
    const assessedCount = new Set(latest.map((result) => result.childId)).size;
    const domainScores: DomainCohortScore[] = domains.flatMap((domain) => {
      const bucket = domainAccum.get(domain.id);
      if (!bucket || bucket.results === 0) return [];
      return [
        {
          domainId: domain.id,
          domainName: domain.name,
          domainSlug: domain.slug,
          icon: domain.icon,
          scorePct: pct(bucket.score / bucket.results),
          childCount: bucket.children.size,
          resultCount: bucket.results,
        },
      ];
    });

    return {
      childrenCount: children.length,
      assessedCount,
      coveragePct: pct(assessedCount / children.length),
      sessionsThisWeek,
      openSessionCount,
      openSessions,
      // Teacher-flagged children first: a human judgement outranks the heuristic.
      attention: attention.sort((a, b) =>
        a.reason === b.reason ? a.childName.localeCompare(b.childName, 'he') : a.reason === 'WATCH_FLAG' ? -1 : 1,
      ),
      notStarted,
      domains: domainScores,
      recentSessions: recent,
    };
  }

  /**
   * Sittings still open (§7's `openSessionCount`), with enough to resume
   * directly. Oldest first — a session left open the longest is the one most
   * likely to have been forgotten, not the one a teacher just walked away from.
   */
  private async openSessions(kindergartenId: string, limit: number): Promise<OpenSession[]> {
    const rows = await this.prisma.session.findMany({
      where: {
        kindergartenId,
        deletedAt: null,
        mode: 'ASSESSMENT',
        completedAt: null,
        abandonedAt: null,
      },
      orderBy: { startedAt: 'asc' },
      take: limit,
      select: {
        id: true,
        childId: true,
        startedAt: true,
        mode: true,
        child: { select: { displayName: true, photoUrl: true } },
        plan: { select: { status: true } },
      },
    });

    return rows.map((row) => ({
      sessionId: row.id,
      childId: row.childId,
      childName: row.child.displayName,
      childPhotoUrl: row.child.photoUrl,
      startedAt: row.startedAt.toISOString(),
      mode: row.mode,
      doneCount: row.plan.filter((item) => item.status === 'DONE').length,
      totalCount: row.plan.length,
    }));
  }

  private async recentSessions(kindergartenId: string, limit: number): Promise<RecentSession[]> {
    const rows = await this.prisma.session.findMany({
      where: { kindergartenId, deletedAt: null, mode: 'ASSESSMENT' },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        childId: true,
        startedAt: true,
        completedAt: true,
        child: { select: { displayName: true, photoUrl: true } },
        results: {
          select: { rating: true, subdomain: { select: { domain: { select: { name: true } } } } },
        },
      },
    });

    return rows.map((row) => {
      const tally = this.analytics.tally(row.results);
      const domainNames = [
        ...new Set(row.results.map((r) => r.subdomain.domain.name)),
      ];
      return {
        sessionId: row.id,
        childId: row.childId,
        childName: row.child.displayName,
        childPhotoUrl: row.child.photoUrl,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        domainNames,
        present: tally.present,
        partial: tally.partial,
        absent: tally.absent,
      };
    });
  }
}

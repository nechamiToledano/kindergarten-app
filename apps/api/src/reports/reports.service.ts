import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChildProgression,
  ChildVsGroup,
  CrossChildPattern,
  KindergartenSummary,
  Principal,
  Rating,
  ReportSubdomain,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';

const EMPTY_DIST = { PRESENT: 0, PARTIALLY_PRESENT: 0, ABSENT: 0 } as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireChild(kindergartenId: string, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, kindergartenId, deletedAt: null },
    });
    if (!child) throw new NotFoundException('Child not found');
    return child;
  }

  /** Spec §7 view 1. */
  async childProgression(principal: Principal, childId: string): Promise<ChildProgression> {
    const kindergartenId = requireTenant(principal);
    const child = await this.requireChild(kindergartenId, childId);
    const results = await this.prisma.subdomainResult.findMany({
      where: { session: { childId, kindergartenId, deletedAt: null, mode: 'ASSESSMENT' } },
      include: { session: true, subdomain: { include: { domain: true } } },
      orderBy: { session: { startedAt: 'asc' } },
    });
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
    };
  }

  /** Spec §7 view 2 — child's latest rating per subdomain vs cohort distribution. */
  async childVsGroup(principal: Principal, childId: string): Promise<ChildVsGroup> {
    const kindergartenId = requireTenant(principal);
    const child = await this.requireChild(kindergartenId, childId);
    const all = await this.prisma.subdomainResult.findMany({
      where: { session: { kindergartenId, deletedAt: null, mode: 'ASSESSMENT' } },
      include: { session: true, subdomain: true },
      orderBy: { createdAt: 'desc' },
    });

    const dist = new Map<string, { PRESENT: number; PARTIALLY_PRESENT: number; ABSENT: number }>();
    const subName = new Map<string, string>();
    const latestByChildSub = new Map<string, Rating>();
    for (const r of all) {
      subName.set(r.subdomainId, r.subdomain.name);
      const key = `${r.session.childId}:${r.subdomainId}`;
      if (!latestByChildSub.has(key)) latestByChildSub.set(key, r.rating as Rating);
    }
    for (const [key, rating] of latestByChildSub) {
      const subdomainId = key.split(':')[1];
      const bucket = dist.get(subdomainId) ?? { ...EMPTY_DIST };
      bucket[rating] += 1;
      dist.set(subdomainId, bucket);
    }

    const rows = [...latestByChildSub]
      .filter(([key]) => key.startsWith(`${childId}:`))
      .map(([key, childRating]) => {
        const subdomainId = key.split(':')[1];
        return {
          subdomainId,
          subdomainName: subName.get(subdomainId) ?? subdomainId,
          childRating,
          distribution: dist.get(subdomainId) ?? { ...EMPTY_DIST },
        };
      })
      .sort((a, b) => a.subdomainName.localeCompare(b.subdomainName, 'he'));
    return { childId, childName: child.displayName, rows };
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

    const results = await this.prisma.subdomainResult.findMany({
      where: { subdomainId, session: { kindergartenId, deletedAt: null, mode: 'ASSESSMENT' } },
      include: { session: { include: { child: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<string, { rating: Rating; displayName: string }>();
    for (const r of results) {
      if (!latest.has(r.session.childId)) {
        latest.set(r.session.childId, {
          rating: r.rating as Rating,
          displayName: r.session.child.displayName,
        });
      }
    }
    const strong: { id: string; displayName: string }[] = [];
    const partial: { id: string; displayName: string }[] = [];
    const needsSupport: { id: string; displayName: string }[] = [];
    for (const [id, { rating, displayName }] of latest) {
      const entry = { id, displayName };
      if (rating === 'PRESENT') strong.push(entry);
      else if (rating === 'PARTIALLY_PRESENT') partial.push(entry);
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
      where: { session: { kindergartenId, deletedAt: null, mode: 'ASSESSMENT' } },
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
   * M7 §3.1 — the home-dashboard summary. Deliberately just a concentration of
   * queries already used elsewhere in this module (§12) — no new business logic.
   */
  async kindergartenSummary(principal: Principal): Promise<KindergartenSummary> {
    const kindergartenId = requireTenant(principal);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [childrenCount, sessionsThisWeek, childrenIds, monthSessions, recent] =
      await Promise.all([
        this.prisma.child.count({ where: { kindergartenId, deletedAt: null } }),
        this.prisma.session.count({
          where: {
            kindergartenId,
            deletedAt: null,
            mode: 'ASSESSMENT',
            startedAt: { gte: startOfWeek },
          },
        }),
        this.prisma.child.findMany({
          where: { kindergartenId, deletedAt: null },
          select: { id: true },
        }),
        this.prisma.session.findMany({
          where: {
            kindergartenId,
            deletedAt: null,
            mode: 'ASSESSMENT',
            startedAt: { gte: startOfMonth },
          },
          select: { childId: true },
        }),
        this.prisma.session.findMany({
          where: { kindergartenId, deletedAt: null, mode: 'ASSESSMENT' },
          orderBy: { startedAt: 'desc' },
          take: 5,
          include: {
            child: true,
            results: { include: { subdomain: { include: { domain: true } } }, take: 1 },
          },
        }),
      ]);

    const diagnosedThisMonth = new Set(monthSessions.map((s) => s.childId)).size;
    const diagnosedPctThisMonth =
      childrenIds.length === 0 ? 0 : Math.round((diagnosedThisMonth / childrenIds.length) * 100);

    // Weakest subdomain this month, by count of non-PRESENT ratings (reuses §12's grouping idea).
    const monthResults = await this.prisma.subdomainResult.findMany({
      where: {
        session: { kindergartenId, deletedAt: null, mode: 'ASSESSMENT', startedAt: { gte: startOfMonth } },
        rating: { in: ['PARTIALLY_PRESENT', 'ABSENT'] },
      },
      include: { subdomain: true },
    });
    const challengeCounts = new Map<string, number>();
    for (const r of monthResults) {
      challengeCounts.set(r.subdomain.name, (challengeCounts.get(r.subdomain.name) ?? 0) + 1);
    }
    let topChallengeDomain: string | null = null;
    let topCount = 0;
    for (const [name, count] of challengeCounts) {
      if (count > topCount) {
        topCount = count;
        topChallengeDomain = name;
      }
    }

    return {
      childrenCount,
      sessionsThisWeek,
      diagnosedPctThisMonth,
      topChallengeDomain,
      recentSessions: recent.map((s) => ({
        sessionId: s.id,
        childId: s.childId,
        childName: s.child.displayName,
        domainName: s.results[0]?.subdomain.domain.name ?? null,
        startedAt: s.startedAt.toISOString(),
        rating: (s.results[0]?.rating as Rating | undefined) ?? null,
      })),
    };
  }
}

import { Injectable } from '@nestjs/common';
import type {
  ChildProgression,
  ChildVsGroup,
  CrossChildPattern,
  Principal,
  Rating,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';

const EMPTY_DIST = { PRESENT: 0, PARTIALLY_PRESENT: 0, ABSENT: 0 } as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Spec §7 view 1. */
  async childProgression(principal: Principal, childId: string): Promise<ChildProgression> {
    const kindergartenId = requireTenant(principal);
    const results = await this.prisma.subdomainResult.findMany({
      where: { session: { childId, kindergartenId, deletedAt: null } },
      include: { session: true, subdomain: true },
      orderBy: { session: { startedAt: 'asc' } },
    });
    return {
      childId,
      points: results.map((r) => ({
        sessionId: r.sessionId,
        startedAt: r.session.startedAt.toISOString(),
        domainId: r.subdomain.domainId,
        subdomainId: r.subdomainId,
        subdomainVersionId: r.subdomainVersionId,
        rating: r.rating as Rating,
      })),
    };
  }

  /** Spec §7 view 2 — child's latest rating per subdomain vs cohort distribution. */
  async childVsGroup(principal: Principal, childId: string): Promise<ChildVsGroup> {
    const kindergartenId = requireTenant(principal);
    const all = await this.prisma.subdomainResult.findMany({
      where: { session: { kindergartenId, deletedAt: null } },
      include: { session: true },
      orderBy: { createdAt: 'desc' },
    });

    const dist = new Map<string, { PRESENT: number; PARTIALLY_PRESENT: number; ABSENT: number }>();
    const latestByChildSub = new Map<string, Rating>();
    for (const r of all) {
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
        return { subdomainId, childRating, distribution: dist.get(subdomainId) ?? { ...EMPTY_DIST } };
      });
    return { childId, rows };
  }

  /** Spec §7 view 3 — the grouping report. */
  async crossChildPatterns(
    principal: Principal,
    subdomainId: string,
  ): Promise<CrossChildPattern> {
    const kindergartenId = requireTenant(principal);
    const results = await this.prisma.subdomainResult.findMany({
      where: { subdomainId, session: { kindergartenId, deletedAt: null } },
      include: { session: true },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<string, Rating>();
    for (const r of results) {
      if (!latest.has(r.session.childId)) latest.set(r.session.childId, r.rating as Rating);
    }
    const strong: string[] = [];
    const partial: string[] = [];
    const needsSupport: string[] = [];
    for (const [childId, rating] of latest) {
      if (rating === 'PRESENT') strong.push(childId);
      else if (rating === 'PARTIALLY_PRESENT') partial.push(childId);
      else needsSupport.push(childId);
    }
    return { subdomainId, strong, partial, needsSupport };
  }
}

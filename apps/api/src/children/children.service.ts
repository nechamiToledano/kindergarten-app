import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AgeBands,
  AgeGroup,
  ChildDomainSummary,
  ChildListItem,
  ChildListQuery,
  ChildOverview,
  CreateChild,
  Principal,
  Rating,
  UpdateChild,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';
import { CLOCK, ageGroupOf, birthDateRangeFor, type ClockPort } from '../common/clock.js';
import { AuditService } from '../common/audit.service.js';
import { AnalyticsService, RATING_SCORE, pct } from '../analytics/analytics.service.js';
import { SettingsService } from '../settings/settings.service.js';

type ChildRow = {
  id: string;
  kindergartenId: string;
  displayName: string;
  birthDate: Date;
  photoUrl: string | null;
  watch: boolean;
};

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  private db(principal: Principal) {
    return this.prisma.forTenant(requireTenant(principal));
  }

  private decorate(child: ChildRow, bands: AgeBands) {
    return {
      ...child,
      birthDate: child.birthDate.toISOString().slice(0, 10),
      currentAgeGroup: ageGroupOf(child.birthDate, this.clock.now(), bands),
    };
  }

  /**
   * The roster.
   *
   * Two changes worth naming. Age filtering is now a `birthDate` range in SQL —
   * it used to fetch every child and filter the decorated array in Node, so the
   * filter could not be combined with pagination without lying about the count.
   * And each row carries its screening state, computed here in three bounded
   * queries rather than by the browser downloading every session in the
   * kindergarten.
   */
  async list(principal: Principal, query: ChildListQuery) {
    const kindergartenId = requireTenant(principal);
    const now = this.clock.now();
    const bands = await this.settings.get('assessment.ageBands');

    const where: Prisma.ChildWhereInput = {
      kindergartenId,
      deletedAt: null,
      ...(query.search && { displayName: { contains: query.search, mode: 'insensitive' } }),
      ...(query.watch !== undefined && { watch: query.watch }),
      ...(query.ageGroup && { birthDate: birthDateRangeFor(query.ageGroup, now, bands) }),
    };

    // `status` is derived, so it cannot be a SQL predicate. Every other filter is
    // pushed down; status is applied to the built rows and the total adjusted, so
    // the client is never told there are more pages than it can reach.
    const filteringByStatus = query.status !== undefined;
    const skip = filteringByStatus ? 0 : (query.page - 1) * query.pageSize;
    const take = filteringByStatus ? undefined : query.pageSize;

    const [rows, total] = await Promise.all([
      this.prisma.child.findMany({ where, orderBy: { displayName: 'asc' }, skip, take }),
      this.prisma.child.count({ where }),
    ]);

    const built = await this.buildListItems(kindergartenId, rows, bands);
    if (!filteringByStatus) {
      return { items: built, total, page: query.page, pageSize: query.pageSize };
    }

    const matching = built.filter((item) => item.status === query.status);
    const start = (query.page - 1) * query.pageSize;
    return {
      items: matching.slice(start, start + query.pageSize),
      total: matching.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Decorate a page of children with their screening state. */
  private async buildListItems(
    kindergartenId: string,
    rows: ChildRow[],
    bands: AgeBands,
  ): Promise<ChildListItem[]> {
    if (rows.length === 0) return [];
    const now = this.clock.now();
    const ids = rows.map((row) => row.id);
    const ageGroups = rows.map((row) => ageGroupOf(row.birthDate, now, bands));

    const [results, sessions, catalogues, concernThreshold] = await Promise.all([
      this.analytics.latestResults(kindergartenId, ids),
      this.analytics.sessionStats(kindergartenId, ids),
      this.analytics.applicableCatalogues(ageGroups),
      this.settings.get('assessment.concernThreshold'),
    ]);

    const byChild = this.analytics.groupByChild(results);
    const sessionsByChild = new Map(sessions.map((s) => [s.childId, s]));

    return rows.map((row, index) => {
      const ageGroup = ageGroups[index];
      const latest = byChild.get(row.id) ?? [];
      const stats = sessionsByChild.get(row.id);
      const tally = this.analytics.tally(latest);
      const applicable = catalogues.get(ageGroup)?.total ?? 0;

      return {
        ...this.decorate(row, bands),
        currentAgeGroup: ageGroup,
        status: this.analytics.status(
          {
            watch: row.watch,
            assessed: tally.assessed,
            absent: tally.absent,
            partial: tally.partial,
            presentWithSupport: tally.presentWithSupport,
            hasOpenSession: !!stats?.openSessionId,
            hasAnySession: !!stats?.lastSessionAt,
          },
          concernThreshold,
        ),
        assessedCount: tally.assessed,
        applicableCount: applicable,
        coveragePct: applicable === 0 ? 0 : pct(tally.assessed / applicable),
        scorePct: tally.scorePct,
        lastSessionAt: stats?.lastSessionAt?.toISOString() ?? null,
        openSessionId: stats?.openSessionId ?? null,
      };
    });
  }

  async get(principal: Principal, id: string) {
    const child = await this.db(principal).child.findFirst({ where: { id, deletedAt: null } });
    if (!child) throw new NotFoundException('Child not found');
    return this.decorate(child, await this.settings.get('assessment.ageBands'));
  }

  /**
   * The child workspace, in one request.
   *
   * The screen needs identity, per-domain standing, strengths, gaps and session
   * history. Served separately that is five round trips plus the whole catalogue;
   * served here it is four queries whose cost does not grow with the size of the
   * kindergarten.
   */
  async overview(principal: Principal, id: string): Promise<ChildOverview> {
    const kindergartenId = requireTenant(principal);
    const row = await this.prisma.child.findFirst({
      where: { id, kindergartenId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Child not found');

    const bands = await this.settings.get('assessment.ageBands');
    const ageGroup = ageGroupOf(row.birthDate, this.clock.now(), bands);
    const [[child], latest, catalogue, domains, sessions] = await Promise.all([
      this.buildListItems(kindergartenId, [row], bands),
      this.analytics.latestResults(kindergartenId, [row.id]),
      this.analytics.applicableCatalogue(ageGroup),
      this.prisma.domain.findMany({
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
      }),
      this.recentSessions(kindergartenId, row.id),
    ]);

    const byDomain = new Map<string, typeof latest>();
    for (const result of latest) {
      const bucket = byDomain.get(result.domainId);
      if (bucket) bucket.push(result);
      else byDomain.set(result.domainId, [result]);
    }

    const domainSummaries: ChildDomainSummary[] = domains
      .map((domain) => {
        const results = byDomain.get(domain.id) ?? [];
        const tally = this.analytics.tally(results);
        return {
          domainId: domain.id,
          domainName: domain.name,
          domainSlug: domain.slug,
          icon: domain.icon,
          present: tally.present,
          presentWithSupport: tally.presentWithSupport,
          partial: tally.partial,
          absent: tally.absent,
          assessed: tally.assessed,
          applicable: catalogue.byDomain.get(domain.id) ?? 0,
          scorePct: tally.scorePct,
        };
      })
      // A domain with no applicable content for this age band is not a gap in the
      // child's development; it is simply not part of their screening.
      .filter((summary) => summary.applicable > 0 || summary.assessed > 0);

    const domainNameById = new Map(domains.map((d) => [d.id, d.name]));
    const ranked = [...latest].sort(
      (a, b) => RATING_SCORE[b.rating] - RATING_SCORE[a.rating] || +b.createdAt - +a.createdAt,
    );

    return {
      child,
      domains: domainSummaries,
      strengths: ranked
        .filter((r) => r.rating === 'PRESENT')
        .slice(0, 5)
        .map((r) => ({
          subdomainId: r.subdomainId,
          subdomainName: r.subdomainName,
          domainName: domainNameById.get(r.domainId) ?? '',
        })),
      gaps: ranked
        .filter((r) => r.rating !== 'PRESENT')
        .reverse()
        .slice(0, 5)
        .map((r) => ({
          subdomainId: r.subdomainId,
          subdomainName: r.subdomainName,
          domainName: domainNameById.get(r.domainId) ?? '',
          rating: r.rating as Rating,
          at: r.createdAt.toISOString(),
        })),
      recentSessions: sessions,
    };
  }

  private async recentSessions(kindergartenId: string, childId: string) {
    const rows = await this.prisma.session.findMany({
      where: { kindergartenId, childId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        abandonedAt: true,
        mode: true,
        _count: { select: { plan: true } },
        results: { select: { rating: true } },
      },
    });

    return rows.map((row) => {
      const tally = this.analytics.tally(row.results);
      return {
        sessionId: row.id,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        abandonedAt: row.abandonedAt?.toISOString() ?? null,
        mode: row.mode,
        total: row._count.plan,
        done: row.results.length,
        present: tally.present,
        presentWithSupport: tally.presentWithSupport,
        partial: tally.partial,
        absent: tally.absent,
      };
    });
  }

  async create(principal: Principal, input: CreateChild) {
    const child = await this.prisma.child.create({
      data: {
        kindergartenId: requireTenant(principal),
        displayName: input.displayName,
        birthDate: new Date(input.birthDate),
        photoUrl: input.photoUrl ?? null,
        watch: input.watch ?? false,
      },
    });
    await this.audit.record(principal.sub, 'child.create', 'Child', child.id);
    return this.decorate(child, await this.settings.get('assessment.ageBands'));
  }

  async update(principal: Principal, id: string, input: UpdateChild) {
    await this.get(principal, id);
    const child = await this.db(principal).child.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.birthDate !== undefined && { birthDate: new Date(input.birthDate) }),
        ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
        ...(input.watch !== undefined && { watch: input.watch }),
      },
    });
    await this.audit.record(principal.sub, 'child.update', 'Child', id, {
      // Flagging a child for follow-up is a clinical judgement; keep the trail.
      ...(input.watch !== undefined && { watch: input.watch }),
    });
    return this.decorate(child, await this.settings.get('assessment.ageBands'));
  }

  async remove(principal: Principal, id: string) {
    await this.get(principal, id);
    await this.db(principal).child.update({ where: { id }, data: { deletedAt: this.clock.now() } });
    await this.audit.record(principal.sub, 'child.delete', 'Child', id);
    return { id, deleted: true };
  }

  /** Age band used for planning an assessment right now. */
  async ageGroupFor(principal: Principal, id: string): Promise<AgeGroup> {
    const child = await this.db(principal).child.findFirst({
      where: { id, deletedAt: null },
      select: { birthDate: true },
    });
    if (!child) throw new NotFoundException('Child not found');
    return ageGroupOf(child.birthDate, this.clock.now(), await this.settings.get('assessment.ageBands'));
  }
}

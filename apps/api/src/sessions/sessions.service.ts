import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateSession,
  Principal,
  Rating,
  SessionDetail,
  SubmitResult,
  SyncBatch,
  SyncBatchResult,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';
import { CLOCK, ageGroupOf, type ClockPort } from '../common/clock.js';
import { AuditService } from '../common/audit.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  private db(principal: Principal) {
    return this.prisma.forTenant(requireTenant(principal));
  }

  /**
   * Start a planned sitting.
   *
   * M10 §2 — the plan is written with the session, in one transaction. Before
   * this a session recorded only what happened to be answered, so the runner
   * could show no progress, resume nothing, and could not tell a subdomain that
   * was skipped from one that was never reached.
   */
  async create(principal: Principal, input: CreateSession) {
    const kindergartenId = requireTenant(principal);
    const child = await this.prisma.child.findFirst({
      where: { id: input.childId, kindergartenId, deletedAt: null },
    });
    if (!child) throw new NotFoundException('Child not found');

    // Every planned subdomain must exist and be playable, checked once here so
    // the runner cannot dead-end on a missing game halfway through a sitting.
    const planIds = [...new Set(input.plan)];
    const playable = await this.prisma.subdomain.findMany({
      where: { id: { in: planIds }, deletedAt: null, versions: { some: {} } },
      select: { id: true },
    });
    if (playable.length !== planIds.length) {
      const known = new Set(playable.map((row) => row.id));
      throw new BadRequestException({
        error: 'UnplayableSubdomains',
        message: 'Some planned subdomains do not exist or have no published version',
        details: planIds.filter((id) => !known.has(id)),
      });
    }

    const startedAt = this.clock.now();
    const bands = await this.settings.get('assessment.ageBands');
    const session = await this.prisma.session.create({
      data: {
        kindergartenId,
        childId: child.id,
        startedAt,
        ageGroupAtTime: ageGroupOf(child.birthDate, startedAt, bands),
        mode: input.mode,
        plan: {
          create: planIds.map((subdomainId, orderIndex) => ({ subdomainId, orderIndex })),
        },
      },
    });
    await this.audit.record(principal.sub, 'session.create', 'Session', session.id, {
      mode: session.mode,
      planSize: planIds.length,
    });
    return this.get(principal, session.id);
  }

  /** A session with its plan, progress and the rating recorded against each item. */
  async get(principal: Principal, id: string): Promise<SessionDetail> {
    const session = await this.db(principal).session.findFirst({
      where: { id, deletedAt: null },
      include: {
        child: { select: { displayName: true } },
        plan: {
          orderBy: { orderIndex: 'asc' },
          include: {
            subdomain: {
              select: { name: true, domainId: true, domain: { select: { name: true } } },
            },
          },
        },
        results: { select: { subdomainId: true, rating: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    const ratingBySubdomain = new Map(session.results.map((r) => [r.subdomainId, r.rating]));
    const plan = session.plan.map((item) => ({
      id: item.id,
      subdomainId: item.subdomainId,
      subdomainName: item.subdomain.name,
      domainId: item.subdomain.domainId,
      domainName: item.subdomain.domain.name,
      orderIndex: item.orderIndex,
      status: item.status,
      rating: (ratingBySubdomain.get(item.subdomainId) as Rating | undefined) ?? null,
    }));

    return {
      id: session.id,
      childId: session.childId,
      childName: session.child.displayName,
      kindergartenId: session.kindergartenId,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      abandonedAt: session.abandonedAt?.toISOString() ?? null,
      ageGroupAtTime: session.ageGroupAtTime,
      mode: session.mode,
      plan,
      progress: {
        total: plan.length,
        done: plan.filter((item) => item.status === 'DONE').length,
        skipped: plan.filter((item) => item.status === 'SKIPPED').length,
        pending: plan.filter((item) => item.status === 'PENDING').length,
      },
    };
  }

  /**
   * Idempotent on `clientId` (§11.5): a retried sync of the same result is a
   * no-op that reports the row as a duplicate rather than creating another.
   *
   * Writing the result also advances its plan item, in the same transaction, so
   * progress can never disagree with the results actually recorded.
   */
  async submitResult(
    principal: Principal,
    result: SubmitResult,
  ): Promise<{ status: 'accepted' | 'duplicate'; id: string }> {
    const kindergartenId = requireTenant(principal);

    // Confirms the session belongs to this tenant, and gives us the child to
    // denormalise onto the result.
    const session = await this.prisma.session.findFirst({
      where: { id: result.sessionId, kindergartenId, deletedAt: null },
      select: { id: true, childId: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    const existing = await this.prisma.subdomainResult.findUnique({
      where: { clientId: result.clientId },
    });
    if (existing) return { status: 'duplicate', id: existing.id };

    const version = await this.prisma.subdomainVersion.findUnique({
      where: { id: result.subdomainVersionId },
    });
    if (!version || version.subdomainId !== result.subdomainId) {
      throw new NotFoundException('subdomainVersion does not match subdomain');
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.subdomainResult.create({
          data: {
            clientId: result.clientId,
            sessionId: session.id,
            kindergartenId,
            childId: session.childId,
            subdomainId: result.subdomainId,
            subdomainVersionId: result.subdomainVersionId,
            attemptsCount: result.attemptsCount,
            rating: result.rating,
            teacherNote: result.teacherNote,
            rawAnswers: result.rawAnswers as unknown as Prisma.InputJsonValue,
          },
        });
        // A practice run may play a subdomain that was never planned; that is not
        // an error, there is simply no item to advance.
        await tx.sessionPlanItem.updateMany({
          where: { sessionId: session.id, subdomainId: result.subdomainId },
          data: { status: 'DONE' },
        });
        return created;
      });
      await this.audit.record(principal.sub, 'result.submit', 'SubdomainResult', row.id);
      return { status: 'accepted', id: row.id };
    } catch (err: unknown) {
      // Lost a race on the unique clientId — treat as duplicate.
      if (typeof err === 'object' && err && (err as { code?: string }).code === 'P2002') {
        const row = await this.prisma.subdomainResult.findUnique({
          where: { clientId: result.clientId },
        });
        if (row) return { status: 'duplicate', id: row.id };
      }
      throw err;
    }
  }

  async sync(principal: Principal, batch: SyncBatch): Promise<SyncBatchResult> {
    const accepted: string[] = [];
    const duplicates: string[] = [];
    for (const result of batch.results) {
      const outcome = await this.submitResult(principal, result);
      (outcome.status === 'accepted' ? accepted : duplicates).push(result.clientId);
    }
    return { accepted, duplicates };
  }

  /** Record that a planned subdomain was deliberately not run. */
  async skip(principal: Principal, sessionId: string, subdomainId: string) {
    await this.get(principal, sessionId);
    const updated = await this.prisma.sessionPlanItem.updateMany({
      where: { sessionId, subdomainId, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    });
    if (updated.count === 0) {
      throw new NotFoundException('No pending plan item for that subdomain');
    }
    await this.audit.record(principal.sub, 'session.skip', 'Session', sessionId, { subdomainId });
    return this.get(principal, sessionId);
  }

  async complete(principal: Principal, id: string) {
    await this.get(principal, id);
    await this.db(principal).session.update({
      where: { id },
      data: { completedAt: this.clock.now() },
    });
    await this.audit.record(principal.sub, 'session.complete', 'Session', id);
    return this.get(principal, id);
  }

  /**
   * End a sitting early.
   *
   * The dashboard previously counted a session the teacher walked away from as
   * open forever — the reason the database holds 24 sessions against 9 results.
   * Anything still pending is recorded as skipped, so the sitting closes with an
   * honest account of what was covered instead of being silently discarded.
   */
  async abandon(principal: Principal, id: string) {
    await this.get(principal, id);
    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.sessionPlanItem.updateMany({
        where: { sessionId: id, status: 'PENDING' },
        data: { status: 'SKIPPED' },
      }),
      this.prisma.session.update({ where: { id }, data: { abandonedAt: now } }),
    ]);
    await this.audit.record(principal.sub, 'session.abandon', 'Session', id);
    return this.get(principal, id);
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateSession, Principal, SubmitResult, SyncBatch, SyncBatchResult } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';
import { CLOCK, ageGroupOf, type ClockPort } from '../common/clock.js';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  private db(principal: Principal) {
    return this.prisma.forTenant(requireTenant(principal));
  }

  async create(principal: Principal, input: CreateSession) {
    const db = this.db(principal);
    const child = await db.child.findFirst({ where: { id: input.childId, deletedAt: null } });
    if (!child) throw new NotFoundException('Child not found');

    const session = await this.prisma.session.create({
      data: {
        kindergartenId: requireTenant(principal),
        childId: child.id,
        startedAt: this.clock.now(),
        ageGroupAtTime: ageGroupOf(child.birthDate, this.clock.now()),
        mode: input.mode ?? 'ASSESSMENT',
      },
    });
    await this.audit.record(principal.sub, 'session.create', 'Session', session.id);
    return session;
  }

  async get(principal: Principal, id: string) {
    const session = await this.db(principal).session.findFirst({
      where: { id, deletedAt: null },
      include: { results: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  /**
   * Idempotent on `clientId` (§11.5): a retried sync of the same result is a
   * no-op that reports the row as a duplicate rather than creating another.
   */
  async submitResult(
    principal: Principal,
    result: SubmitResult,
  ): Promise<{ status: 'accepted' | 'duplicate'; id: string }> {
    // Confirm the session belongs to this tenant before writing.
    await this.get(principal, result.sessionId);

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
      const row = await this.prisma.subdomainResult.create({
        data: {
          clientId: result.clientId,
          sessionId: result.sessionId,
          subdomainId: result.subdomainId,
          subdomainVersionId: result.subdomainVersionId,
          attemptsCount: result.attemptsCount,
          rating: result.rating,
          teacherNote: result.teacherNote,
          rawAnswers: result.rawAnswers as unknown as Prisma.InputJsonValue,
        },
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

  async complete(principal: Principal, id: string) {
    await this.get(principal, id);
    return this.db(principal).session.update({
      where: { id },
      data: { completedAt: this.clock.now() },
    });
  }
}

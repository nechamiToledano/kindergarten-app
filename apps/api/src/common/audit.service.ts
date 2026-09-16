import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditLogEntry, AuditLogQuery } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

/** Change accountability (§9.4) — every content or rating mutation is logged. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    actorId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ?? null,
        metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * M11 — network-wide oversight. AuditLog carries no kindergarten column (an
   * action may target a Domain, a User, a Network — entities that don't all
   * belong to one tenant), so this is scoped by role rather than by tenant:
   * only a NETWORK_ADMIN can see it, at the controller.
   */
  async list(query: AuditLogQuery): Promise<{ items: AuditLogEntry[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity && { entity: query.entity }),
      ...(query.action && { action: { contains: query.action, mode: 'insensitive' } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(actors.map((a) => [a.id, a.displayName]));
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorName: r.actorId ? (nameById.get(r.actorId) ?? null) : null,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}

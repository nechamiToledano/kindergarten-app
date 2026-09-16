import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateKindergarten, Principal, UpdateKindergarten } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A network admin sees their network; a kindergarten admin sees their own.
   *
   * This used to fall through to `{ deletedAt: null }` — an unscoped filter — for
   * a principal with neither a network nor a kindergarten, which handed a
   * NETWORK_ADMIN whose networkId had not been set every kindergarten in the
   * system. There is no such thing as a legitimate unscoped listing here, so the
   * fall-through is now a refusal.
   */
  private scope(principal: Principal): Prisma.KindergartenWhereInput {
    if (principal.role === 'NETWORK_ADMIN') {
      if (!principal.networkId) {
        throw new ForbiddenException('This account is not attached to a network');
      }
      return { networkId: principal.networkId, deletedAt: null };
    }
    if (principal.kindergartenId) {
      return { id: principal.kindergartenId, deletedAt: null };
    }
    throw new ForbiddenException('This account is not attached to a kindergarten');
  }

  list(principal: Principal) {
    return this.prisma.kindergarten.findMany({ where: this.scope(principal) });
  }

  async get(principal: Principal, id: string) {
    const kg = await this.prisma.kindergarten.findFirst({
      where: { ...this.scope(principal), id },
    });
    if (!kg) throw new NotFoundException('Kindergarten not found');
    return kg;
  }

  async create(principal: Principal, input: CreateKindergarten) {
    if (principal.role !== 'NETWORK_ADMIN') {
      throw new ForbiddenException('Only a network admin can create kindergartens');
    }
    const kg = await this.prisma.kindergarten.create({
      data: { name: input.name, networkId: input.networkId ?? principal.networkId ?? null },
    });
    await this.audit.record(principal.sub, 'kindergarten.create', 'Kindergarten', kg.id);
    return kg;
  }

  async update(principal: Principal, id: string, input: UpdateKindergarten) {
    await this.get(principal, id);
    const kg = await this.prisma.kindergarten.update({ where: { id }, data: input });
    await this.audit.record(principal.sub, 'kindergarten.update', 'Kindergarten', id);
    return kg;
  }
}

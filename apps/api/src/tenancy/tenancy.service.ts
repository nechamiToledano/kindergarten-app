import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateKindergarten, Principal, UpdateKindergarten } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** A network admin sees their network; a kindergarten admin sees their own. */
  private scope(principal: Principal) {
    if (principal.role === 'NETWORK_ADMIN' && principal.networkId) {
      return { networkId: principal.networkId, deletedAt: null };
    }
    if (principal.kindergartenId) {
      return { id: principal.kindergartenId, deletedAt: null };
    }
    return { deletedAt: null };
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

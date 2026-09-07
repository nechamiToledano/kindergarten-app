import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateChild, Principal, UpdateChild } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenant } from '../common/auth.js';
import { CLOCK, ageGroupOf, type ClockPort } from '../common/clock.js';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  private db(principal: Principal) {
    return this.prisma.forTenant(requireTenant(principal));
  }

  private decorate(child: { birthDate: Date } & Record<string, unknown>) {
    return {
      ...child,
      birthDate: child.birthDate.toISOString().slice(0, 10),
      currentAgeGroup: ageGroupOf(child.birthDate, this.clock.now()),
    };
  }

  async list(principal: Principal) {
    const rows = await this.db(principal).child.findMany({
      where: { deletedAt: null },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((c) => this.decorate(c));
  }

  async get(principal: Principal, id: string) {
    const child = await this.db(principal).child.findFirst({ where: { id, deletedAt: null } });
    if (!child) throw new NotFoundException('Child not found');
    return this.decorate(child);
  }

  async create(principal: Principal, input: CreateChild) {
    const child = await this.prisma.child.create({
      data: {
        kindergartenId: requireTenant(principal),
        displayName: input.displayName,
        birthDate: new Date(input.birthDate),
      },
    });
    await this.audit.record(principal.sub, 'child.create', 'Child', child.id);
    return this.decorate(child);
  }

  async update(principal: Principal, id: string, input: UpdateChild) {
    await this.get(principal, id);
    const child = await this.db(principal).child.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.birthDate !== undefined && { birthDate: new Date(input.birthDate) }),
      },
    });
    await this.audit.record(principal.sub, 'child.update', 'Child', id);
    return this.decorate(child);
  }

  async remove(principal: Principal, id: string) {
    await this.get(principal, id);
    await this.db(principal).child.update({ where: { id }, data: { deletedAt: this.clock.now() } });
    await this.audit.record(principal.sub, 'child.delete', 'Child', id);
    return { id, deleted: true };
  }
}

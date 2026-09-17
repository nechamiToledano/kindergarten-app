import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { CreateUser, Principal, Role, UpdateUser, User } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { SettingsService } from '../settings/settings.service.js';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  kindergartenId: string | null;
};

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  displayName: r.displayName,
  role: r.role,
  kindergartenId: r.kindergartenId,
});

/** Staff & role management (§14.4). CONTENT_EDITOR accounts are provisioned
 * out of band — they are cross-tenant and touch no child data (§13.1). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  /** M11 — the static schema only sets an absolute floor; the real minimum is admin-configurable. */
  private async assertPasswordPolicy(password: string) {
    const policy = await this.settings.get('security.passwordPolicy');
    if (password.length < policy.minLength) {
      throw new BadRequestException(`Password must be at least ${policy.minLength} characters`);
    }
  }

  /** The kindergartens a manager may act within. */
  private async managedKindergartenIds(principal: Principal): Promise<string[]> {
    if (principal.role === 'NETWORK_ADMIN' && principal.networkId) {
      const kgs = await this.prisma.kindergarten.findMany({
        where: { networkId: principal.networkId, deletedAt: null },
        select: { id: true },
      });
      return kgs.map((k) => k.id);
    }
    if (principal.role === 'KINDERGARTEN_ADMIN' && principal.kindergartenId) {
      return [principal.kindergartenId];
    }
    throw new ForbiddenException('Staff management requires an admin account');
  }

  private assertAssignable(principal: Principal, role: Role, kindergartenId: string | null) {
    const allowed: Role[] =
      principal.role === 'NETWORK_ADMIN'
        ? ['TEACHER', 'KINDERGARTEN_ADMIN', 'NETWORK_ADMIN']
        : ['TEACHER', 'KINDERGARTEN_ADMIN'];
    if (!allowed.includes(role)) {
      throw new ForbiddenException(`You cannot assign the ${role} role`);
    }
    if (role !== 'NETWORK_ADMIN' && !kindergartenId) {
      throw new BadRequestException(`${role} must belong to a kindergarten`);
    }
  }

  async list(principal: Principal): Promise<User[]> {
    const ids = await this.managedKindergartenIds(principal);
    const rows = await this.prisma.user.findMany({
      where: { kindergartenId: { in: ids }, deletedAt: null },
      orderBy: { displayName: 'asc' },
    });
    return rows.map(toUser);
  }

  private async requireManaged(principal: Principal, id: string): Promise<UserRow> {
    const ids = await this.managedKindergartenIds(principal);
    const row = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!row || !row.kindergartenId || !ids.includes(row.kindergartenId)) {
      throw new NotFoundException('User not found');
    }
    return row;
  }

  async create(principal: Principal, input: CreateUser): Promise<User> {
    const ids = await this.managedKindergartenIds(principal);
    if (input.kindergartenId && !ids.includes(input.kindergartenId)) {
      throw new ForbiddenException('That kindergarten is outside your scope');
    }
    this.assertAssignable(principal, input.role, input.kindergartenId);
    await this.assertPasswordPolicy(input.password);
    const existing = await this.prisma.user.findFirst({ where: { email: input.email } });
    if (existing) throw new BadRequestException('Email already in use');

    // M11 bugfix — a new NETWORK_ADMIN inherits the creating admin's own
    // network; without this its networkId stays null and the role is
    // unusable (see the doc comment on User.networkId in schema.prisma).
    if (input.role === 'NETWORK_ADMIN' && !principal.networkId) {
      throw new BadRequestException('Your own account has no network to attach the new admin to');
    }

    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await argon2.hash(input.password),
        role: input.role,
        kindergartenId: input.kindergartenId,
        networkId: input.role === 'NETWORK_ADMIN' ? principal.networkId : null,
      },
    });
    await this.audit.record(principal.sub, 'user.create', 'User', row.id, { role: row.role });
    return toUser(row);
  }

  async update(principal: Principal, id: string, input: UpdateUser): Promise<User> {
    if (input.password !== undefined) await this.assertPasswordPolicy(input.password);
    const current = await this.requireManaged(principal, id);
    const nextRole = input.role ?? current.role;
    const nextKg =
      input.kindergartenId !== undefined ? input.kindergartenId : current.kindergartenId;
    if (input.role !== undefined || input.kindergartenId !== undefined) {
      const ids = await this.managedKindergartenIds(principal);
      if (nextKg && !ids.includes(nextKg)) {
        throw new ForbiddenException('That kindergarten is outside your scope');
      }
      this.assertAssignable(principal, nextRole, nextKg);
    }
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.kindergartenId !== undefined && { kindergartenId: input.kindergartenId }),
        ...(input.password !== undefined && { passwordHash: await argon2.hash(input.password) }),
      },
    });
    await this.audit.record(principal.sub, 'user.update', 'User', id);
    return toUser(row);
  }

  async remove(principal: Principal, id: string) {
    if (id === principal.sub) throw new BadRequestException('You cannot deactivate yourself');
    await this.requireManaged(principal, id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), refreshTokenHash: null },
    });
    await this.audit.record(principal.sub, 'user.delete', 'User', id);
    return { id, deleted: true };
  }
}

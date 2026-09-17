import { Injectable } from '@nestjs/common';
import type { Role } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  create(data: {
    email: string;
    displayName: string;
    passwordHash: string;
    role: Role;
    kindergartenId: string | null;
    networkId?: string | null;
  }) {
    return this.prisma.user.create({ data });
  }

  setRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({ where: { id }, data: { refreshTokenHash } });
  }
}

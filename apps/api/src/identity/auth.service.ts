import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type {
  AuthResult,
  CreateUser,
  LoginRequest,
  Principal,
  Role,
  User,
} from '@kga/contracts';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRepository } from './user.repository.js';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  kindergartenId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  private toUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      kindergartenId: row.kindergartenId,
    };
  }

  private async networkIdFor(kindergartenId: string | null): Promise<string | null> {
    if (!kindergartenId) return null;
    const kg = await this.prisma.kindergarten.findUnique({ where: { id: kindergartenId } });
    return kg?.networkId ?? null;
  }

  private async issueTokens(principal: Principal): Promise<AuthResult['tokens']> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const payload = { ...principal };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: accessTtl as unknown as number,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      expiresIn: refreshTtl as unknown as number,
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    });
    await this.users.setRefreshTokenHash(principal.sub, await argon2.hash(refreshToken));
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  async register(input: CreateUser): Promise<User> {
    const row = await this.users.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash: await argon2.hash(input.password),
      role: input.role,
      kindergartenId: input.kindergartenId,
    });
    return this.toUser(row);
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const row = await this.users.findByEmail(input.email);
    if (!row || !(await argon2.verify(row.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const principal: Principal = {
      sub: row.id,
      role: row.role,
      kindergartenId: row.kindergartenId,
      networkId: await this.networkIdFor(row.kindergartenId),
    };
    return { user: this.toUser(row), tokens: await this.issueTokens(principal) };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let principal: Principal;
    try {
      principal = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const row = await this.users.findById(principal.sub);
    if (!row?.refreshTokenHash || !(await argon2.verify(row.refreshTokenHash, refreshToken))) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const next: Principal = {
      sub: row.id,
      role: row.role,
      kindergartenId: row.kindergartenId,
      networkId: await this.networkIdFor(row.kindergartenId),
    };
    return { user: this.toUser(row), tokens: await this.issueTokens(next) };
  }

  async me(principal: Principal): Promise<User> {
    const row = await this.users.findById(principal.sub);
    if (!row) throw new UnauthorizedException();
    return this.toUser(row);
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createDefaultRegistry } from '@kga/game-engine';
import type {
  AgeGroup,
  CreateDomain,
  CreateSubdomain,
  GameConfig,
  Principal,
  SubdomainQuery,
  SubdomainSummary,
  UpdateDomain,
  UpdateSubdomain,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

const registry = createDefaultRegistry();

/** Validate a gameConfig against its plugin's schema (§3.1, §7.1). */
function validateGameConfig(config: GameConfig): GameConfig {
  const plugin = registry.get(config.gameType);
  const result = plugin.configSchema.safeParse(config);
  if (!result.success) {
    throw new BadRequestException({
      error: 'InvalidGameConfig',
      message: `gameConfig is not valid for ${config.gameType}`,
      details: result.error.issues,
    });
  }
  return result.data;
}

/** Derive a stable slug when a content editor does not supply one. */
function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length >= 2) return ascii.slice(0, 60);
  // Hebrew names produce no ASCII; fall back to something deterministic.
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `domain-${hash.toString(16)}`;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * M10 §1 — domains are global now, so this no longer takes an age group.
   * Filtering the *catalogue* by age is `listSubdomains({ ageGroup })`; a domain
   * itself exists across every band.
   */
  listDomains() {
    return this.prisma.domain.findMany({
      where: { deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * The content catalogue — one query, no gameConfig blobs.
   *
   * The previous shape was `GET /content/domains/:id/subdomains`, which forced
   * the library screen into one request per domain and shipped a full gameConfig
   * (hotspot geometry, every image URL) for rows that only render a name and a
   * badge.
   */
  async listSubdomains(query: SubdomainQuery): Promise<SubdomainSummary[]> {
    const where: Prisma.SubdomainWhereInput = {
      deletedAt: null,
      ...(query.domainId && { domainId: query.domainId }),
      ...(query.level && { level: query.level }),
      ...(query.gameType && { gameType: query.gameType }),
      ...(query.ageGroup && { ageGroups: { has: query.ageGroup } }),
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const rows = await this.prisma.subdomain.findMany({
      where,
      orderBy: [{ domain: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
      select: {
        id: true,
        domainId: true,
        name: true,
        orderIndex: true,
        ageGroups: true,
        level: true,
        gameType: true,
        domain: { select: { name: true, slug: true } },
        // A subdomain with no published version cannot be played; the library
        // says so rather than letting a teacher start an assessment that 404s.
        _count: { select: { versions: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      domainId: row.domainId,
      name: row.name,
      orderIndex: row.orderIndex,
      ageGroups: row.ageGroups,
      level: row.level as 1 | 2 | 3,
      gameType: row.gameType,
      domainName: row.domain.name,
      domainSlug: row.domain.slug,
      playable: row._count.versions > 0,
    }));
  }

  /** Immutable config snapshots for a subdomain, newest first (§9.3). */
  listVersions(subdomainId: string) {
    return this.prisma.subdomainVersion.findMany({
      where: { subdomainId },
      orderBy: { version: 'desc' },
    });
  }

  /** Resolve a subdomain plus its current version, for the play surface (§9.3). */
  async getForPlay(id: string) {
    const [resolved] = await this.getManyForPlay([id]);
    if (!resolved) throw new NotFoundException('Subdomain not found or has no published version');
    return resolved;
  }

  /**
   * Resolve a whole session plan in one round trip.
   *
   * The runner used to call `getForPlay` per subdomain with `Promise.all`, which
   * is an N+1 over the network — twelve HTTP requests, each with its own auth and
   * TLS cost, before a child sees the first game on an iPad over kindergarten
   * WiFi. Order follows the caller's `ids`, since that is the plan order.
   */
  async getManyForPlay(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.prisma.subdomain.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const subdomain = byId.get(id);
      const current = subdomain?.versions[0];
      if (!subdomain || !current) return [];
      return [
        {
          id: subdomain.id,
          domainId: subdomain.domainId,
          name: subdomain.name,
          orderIndex: subdomain.orderIndex,
          ageGroups: subdomain.ageGroups,
          level: subdomain.level as 1 | 2 | 3,
          teacherInstruction: subdomain.teacherInstruction,
          childInstruction: subdomain.childInstruction,
          gameType: subdomain.gameType,
          gameConfig: current.gameConfig,
          subdomainVersionId: current.id,
          version: current.version,
        },
      ];
    });
  }

  async createDomain(principal: Principal, input: CreateDomain) {
    const slug = input.slug?.trim() || slugify(input.name);
    const clash = await this.prisma.domain.findUnique({ where: { slug } });
    if (clash) throw new BadRequestException(`A domain with the slug "${slug}" already exists`);

    const domain = await this.prisma.domain.create({
      data: {
        slug,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        orderIndex: input.orderIndex,
      },
    });
    await this.audit.record(principal.sub, 'domain.create', 'Domain', domain.id);
    return domain;
  }

  async updateDomain(principal: Principal, id: string, input: UpdateDomain) {
    const existing = await this.prisma.domain.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Domain not found');
    const domain = await this.prisma.domain.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
      },
    });
    await this.audit.record(principal.sub, 'domain.update', 'Domain', id);
    return domain;
  }

  async removeDomain(principal: Principal, id: string) {
    const existing = await this.prisma.domain.findFirst({
      where: { id, deletedAt: null },
      include: { subdomains: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('Domain not found');
    if (existing.subdomains.length > 0) {
      throw new BadRequestException('Delete the subdomains under this domain first');
    }
    await this.prisma.domain.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(principal.sub, 'domain.delete', 'Domain', id);
    return { id, deleted: true };
  }

  async removeSubdomain(principal: Principal, id: string) {
    const existing = await this.prisma.subdomain.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Subdomain not found');
    await this.prisma.subdomain.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(principal.sub, 'subdomain.delete', 'Subdomain', id);
    return { id, deleted: true };
  }

  async createSubdomain(principal: Principal, input: CreateSubdomain) {
    const config = validateGameConfig(input.gameConfig);
    const domain = await this.prisma.domain.findFirst({
      where: { id: input.domainId, deletedAt: null },
    });
    if (!domain) throw new NotFoundException('Domain not found');

    const subdomain = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subdomain.create({
        data: {
          domainId: input.domainId,
          name: input.name,
          orderIndex: input.orderIndex,
          ageGroups: input.ageGroups,
          level: input.level,
          teacherInstruction: input.teacherInstruction,
          childInstruction: input.childInstruction,
          gameType: input.gameType,
          gameConfig: config,
        },
      });
      await tx.subdomainVersion.create({
        data: {
          subdomainId: created.id,
          version: 1,
          gameType: created.gameType,
          gameConfig: config,
        },
      });
      return created;
    });
    await this.audit.record(principal.sub, 'subdomain.create', 'Subdomain', subdomain.id);
    return this.getForPlay(subdomain.id);
  }

  /** Editing gameConfig cuts a new immutable version so history stays comparable (§9.3). */
  async updateSubdomain(principal: Principal, id: string, input: UpdateSubdomain) {
    const existing = await this.prisma.subdomain.findFirst({
      where: { id, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!existing) throw new NotFoundException('Subdomain not found');

    const nextConfig = input.gameConfig ? validateGameConfig(input.gameConfig) : undefined;
    const configChanged =
      nextConfig !== undefined &&
      JSON.stringify(nextConfig) !== JSON.stringify(existing.gameConfig);

    await this.prisma.$transaction(async (tx) => {
      await tx.subdomain.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
          ...(input.ageGroups !== undefined && { ageGroups: input.ageGroups }),
          ...(input.level !== undefined && { level: input.level }),
          ...(input.domainId !== undefined && { domainId: input.domainId }),
          ...(input.teacherInstruction !== undefined && {
            teacherInstruction: input.teacherInstruction,
          }),
          ...(input.childInstruction !== undefined && {
            childInstruction: input.childInstruction,
          }),
          ...(input.gameType !== undefined && { gameType: input.gameType }),
          ...(nextConfig !== undefined && { gameConfig: nextConfig }),
        },
      });
      if (configChanged) {
        await tx.subdomainVersion.create({
          data: {
            subdomainId: id,
            version: (existing.versions[0]?.version ?? 0) + 1,
            gameType: input.gameType ?? existing.gameType,
            gameConfig: nextConfig!,
          },
        });
      }
    });
    await this.audit.record(principal.sub, 'subdomain.update', 'Subdomain', id, {
      newVersion: configChanged,
    });
    return this.getForPlay(id);
  }

  /**
   * The catalogue a child of this age band should be assessed against.
   *
   * Used by the plan builder and by every coverage figure, so that "12 of 18
   * assessed" counts the same 18 everywhere rather than each screen inventing
   * its own denominator.
   */
  applicableSubdomains(ageGroup: AgeGroup) {
    return this.prisma.subdomain.findMany({
      where: { deletedAt: null, ageGroups: { has: ageGroup }, versions: { some: {} } },
      orderBy: [{ domain: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
      select: {
        id: true,
        name: true,
        level: true,
        domainId: true,
        domain: { select: { id: true, name: true, slug: true, icon: true, orderIndex: true } },
      },
    });
  }
}

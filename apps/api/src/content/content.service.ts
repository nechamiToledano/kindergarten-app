import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createDefaultRegistry } from '@kga/game-engine';
import type {
  AgeGroup,
  CreateSubdomain,
  GameConfig,
  Principal,
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

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listDomains(ageGroup?: AgeGroup) {
    return this.prisma.ageGroupDomain.findMany({
      where: { deletedAt: null, ...(ageGroup && { ageGroup }) },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async listSubdomains(domainId: string) {
    return this.prisma.subdomain.findMany({
      where: { domainId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /** Resolve a subdomain plus its current version, for the play surface (§9.3). */
  async getForPlay(id: string) {
    const subdomain = await this.prisma.subdomain.findFirst({
      where: { id, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!subdomain || subdomain.versions.length === 0) {
      throw new NotFoundException('Subdomain not found or has no published version');
    }
    const [current] = subdomain.versions;
    return {
      id: subdomain.id,
      domainId: subdomain.domainId,
      name: subdomain.name,
      orderIndex: subdomain.orderIndex,
      teacherInstruction: subdomain.teacherInstruction,
      childInstruction: subdomain.childInstruction,
      gameType: subdomain.gameType,
      gameConfig: current.gameConfig,
      subdomainVersionId: current.id,
      version: current.version,
    };
  }

  async createDomain(
    principal: Principal,
    input: { ageGroup: AgeGroup; name: string; orderIndex: number },
  ) {
    const domain = await this.prisma.ageGroupDomain.create({ data: input });
    await this.audit.record(principal.sub, 'domain.create', 'AgeGroupDomain', domain.id);
    return domain;
  }

  async createSubdomain(principal: Principal, input: CreateSubdomain) {
    const config = validateGameConfig(input.gameConfig);
    const subdomain = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subdomain.create({
        data: {
          domainId: input.domainId,
          name: input.name,
          orderIndex: input.orderIndex,
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
}

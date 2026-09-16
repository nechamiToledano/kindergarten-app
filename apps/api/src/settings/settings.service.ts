import { BadRequestException, Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SETTINGS_REGISTRY,
  type AppSetting,
  type SettingKey,
} from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

/**
 * Read/write access to `AppSetting` (M11 — real management).
 *
 * A missing row is not an error: it means nobody has customised that key yet,
 * so `get` returns the code-level default from `SETTINGS_REGISTRY`. This is
 * what lets every setting ship additively — existing behaviour never moves
 * until someone actually edits it from /admin.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AppSetting[]> {
    const rows = await this.prisma.appSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return (Object.keys(SETTINGS_REGISTRY) as SettingKey[]).map((key) => {
      const row = byKey.get(key);
      const def = SETTINGS_REGISTRY[key];
      return {
        key,
        value: row ? row.value : def.default,
        description: row?.description ?? def.description,
        updatedAt: row ? row.updatedAt.toISOString() : null,
      };
    });
  }

  /** Typed accessor for a single key, used by other services (e.g. AnalyticsService callers). */
  async get<K extends SettingKey>(key: K): Promise<(typeof SETTINGS_REGISTRY)[K]['default']> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    const def = SETTINGS_REGISTRY[key];
    if (!row) return def.default;
    const parsed = def.schema.safeParse(row.value);
    // A stored value that no longer parses (schema tightened later) falls back
    // to the default rather than throwing on every read of an unrelated screen.
    return parsed.success ? (parsed.data as (typeof SETTINGS_REGISTRY)[K]['default']) : def.default;
  }

  async update(actorId: string, key: SettingKey, value: unknown): Promise<AppSetting> {
    const def = (SETTINGS_REGISTRY as Record<string, (typeof SETTINGS_REGISTRY)[SettingKey]>)[key];
    if (!def) throw new BadRequestException(`Unknown setting key: ${key}`);
    const parsed = def.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: 'Setting value failed validation',
        details: parsed.error.issues,
      });
    }
    const row = await this.prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: parsed.data as Prisma.InputJsonValue,
        description: def.description,
        updatedById: actorId,
      },
      update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
    });
    await this.audit.record(actorId, 'setting.update', 'AppSetting', key, {
      value: parsed.data as Record<string, unknown>,
    });
    return {
      key: row.key as SettingKey,
      value: row.value,
      description: row.description,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
export class SettingsCoreModule {}

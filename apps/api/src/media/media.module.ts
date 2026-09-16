import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { createDefaultRegistry } from '@kga/game-engine';
import { MediaAssetQuerySchema, type GameConfig, type MediaAssetQuery, type Principal } from '@kga/contracts';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContentService } from '../content/content.service.js';
import { ContentModule } from '../content/content.module.js';
import { AuditService } from '../common/audit.service.js';
import { CurrentUser, Public, Roles } from '../common/auth.js';
import { S3CompatibleStorage } from './s3-compatible.storage.js';

export const STORAGE_PORT = Symbol('StoragePort');

export interface StoragePort {
  getUrl(key: string): string;
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Only implemented by drivers whose bucket isn't publicly reachable (§14.3). */
  get?(key: string): Promise<{ body: Readable; contentType: string }>;
}

/** MVP default (§10.3) — assets ship in the build, served from the CDN. */
@Injectable()
export class StaticAssetStorage implements StoragePort {
  constructor(private readonly config: ConfigService<Env, true>) {}

  getUrl(key: string): string {
    const base = this.config.get('CDN_BASE_URL', { infer: true });
    return base ? `${base.replace(/\/$/, '')}/${key.replace(/^\//, '')}` : `/assets/${key}`;
  }

  put(): Promise<string> {
    throw new Error('StaticAssetStorage is read-only; set STORAGE_DRIVER=r2 to upload (§14.3)');
  }
}

/** One-line registration (§3.3, §14.3): the port resolves to R2, B2, or static by config. */
function storageFactory(config: ConfigService<Env, true>): StoragePort {
  const driver = config.get('STORAGE_DRIVER', { infer: true });

  if (driver === 'r2') {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    const accessKeyId = config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY', { infer: true });
    const bucket = config.get('R2_BUCKET', { infer: true });
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('STORAGE_DRIVER=r2 requires all R2_* environment variables (§14.3)');
    }
    return new S3CompatibleStorage({
      host: `${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId,
      secretAccessKey,
      bucket,
    });
  }

  if (driver === 'b2') {
    const accessKeyId = config.get('B2_KEY_ID', { infer: true });
    const secretAccessKey = config.get('B2_APPLICATION_KEY', { infer: true });
    const bucket = config.get('B2_BUCKET', { infer: true });
    const region = config.get('B2_REGION', { infer: true });
    if (!accessKeyId || !secretAccessKey || !bucket || !region) {
      throw new Error('STORAGE_DRIVER=b2 requires all B2_* environment variables (§14.3)');
    }
    return new S3CompatibleStorage({
      host: `s3.${region}.backblazeb2.com`,
      region,
      accessKeyId,
      secretAccessKey,
      bucket,
    });
  }

  return new StaticAssetStorage(config);
}

const registry = createDefaultRegistry();

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
};

interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly content: ContentService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly audit: AuditService,
  ) {}

  /** Every asset a subdomain needs, for the client preloader (§11.4). */
  async manifestForSubdomain(id: string) {
    const subdomain = await this.content.getForPlay(id);
    const plugin = registry.get(subdomain.gameType);
    return plugin.assetsOf(subdomain.gameConfig as GameConfig);
  }

  /** Backs the `/media/file/:key` proxy for drivers with a private bucket (§14.3). */
  async streamFile(key: string): Promise<{ body: Readable; contentType: string }> {
    if (!this.storage.get) throw new NotFoundException('Asset not found');
    try {
      return await this.storage.get(key);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        throw new NotFoundException('Asset not found');
      }
      throw err;
    }
  }

  /**
   * Store one content asset and return the URL to reference from a gameConfig
   * (§14.3). Also catalogues it in `MediaAsset` (M11) so it shows up in the
   * asset library and can be reused across subdomains instead of re-uploaded.
   */
  async upload(principal: Principal, file: UploadedFileLike | undefined) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(`File exceeds ${UPLOAD_MAX_BYTES / 1024 / 1024}MB`);
    }
    const ext = UPLOAD_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException(`Unsupported type ${file.mimetype}`);

    const safe = file.originalname
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(0, 60);
    const key = `content/${randomUUID()}-${safe}.${ext}`;
    const url = await this.storage.put(key, file.buffer, file.mimetype);
    const kind = file.mimetype.startsWith('audio/') ? 'audio' : 'image';
    await this.prisma.mediaAsset.create({
      data: {
        key,
        url,
        kind,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        originalName: file.originalname || null,
        uploadedById: principal.sub,
      },
    });
    await this.audit.record(principal.sub, 'media.upload', 'Asset', key);
    return { url, key, kind };
  }

  /** The asset library (M11) — every catalogued upload, newest first. */
  async list(query: MediaAssetQuery) {
    const where = {
      ...(query.kind && { kind: query.kind }),
      ...(query.search && { originalName: { contains: query.search, mode: 'insensitive' as const } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        url: r.url,
        key: r.key,
        kind: r.kind as 'image' | 'audio',
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        originalName: r.originalName,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Remove an asset from the library only — the underlying file is left in
   * storage. A subdomain's `gameConfig` holds the URL string directly, so this
   * can never break content that already references it; it only stops the
   * asset from being offered for new content.
   */
  async remove(principal: Principal, id: string) {
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Asset not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit.record(principal.sub, 'media.removeFromLibrary', 'Asset', row.key);
    return { id, deleted: true };
  }
}

@Controller({ path: 'media', version: '1' })
class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get('manifest')
  manifest(@Query('subdomainId') subdomainId: string) {
    return this.media.manifestForSubdomain(subdomainId);
  }

  /** Serves assets from a private bucket driver (§14.3) — content is non-sensitive. */
  @Public()
  @Get('file/:key')
  async file(@Param('key') key: string): Promise<StreamableFile> {
    const { body, contentType } = await this.media.streamFile(key);
    return new StreamableFile(body, { type: contentType });
  }

  /**
   * M7 §3.2 — child photo upload is initiated by a teacher from `apps/web`, not
   * only a content editor from `apps/admin`. Same endpoint, same StoragePort (§10.3).
   */
  @Post('upload')
  @Roles('CONTENT_EDITOR', 'TEACHER', 'KINDERGARTEN_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentUser() principal: Principal, @UploadedFile() file: UploadedFileLike) {
    return this.media.upload(principal, file);
  }

  /** The asset library (M11, §14.3 extended) — content editors only. */
  @Get()
  @Roles('CONTENT_EDITOR')
  list(@Query() query: Record<string, string>) {
    return this.media.list(MediaAssetQuerySchema.parse(query));
  }

  @Delete(':id')
  @Roles('CONTENT_EDITOR')
  remove(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.media.remove(principal, id);
  }
}

@Module({
  imports: [ContentModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    StaticAssetStorage,
    { provide: STORAGE_PORT, useFactory: storageFactory, inject: [ConfigService] },
  ],
  exports: [STORAGE_PORT, MediaService],
})
export class MediaModule {}

import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createDefaultRegistry } from '@kga/game-engine';
import type { GameConfig, Principal } from '@kga/contracts';
import type { Env } from '../config/env.js';
import { ContentService } from '../content/content.service.js';
import { ContentModule } from '../content/content.module.js';
import { AuditService } from '../common/audit.service.js';
import { CurrentUser, Public, Roles } from '../common/auth.js';
import { R2Storage } from './r2.storage.js';

export const STORAGE_PORT = Symbol('StoragePort');

export interface StoragePort {
  getUrl(key: string): string;
  put(key: string, data: Buffer, contentType: string): Promise<string>;
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

/** One-line registration (§3.3, §14.3): the port resolves to R2 or static by config. */
function storageFactory(config: ConfigService<Env, true>): StoragePort {
  if (config.get('STORAGE_DRIVER', { infer: true }) === 'r2') {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    const accessKeyId = config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY', { infer: true });
    const bucket = config.get('R2_BUCKET', { infer: true });
    const publicBaseUrl = config.get('R2_PUBLIC_BASE_URL', { infer: true });
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      throw new Error('STORAGE_DRIVER=r2 requires all R2_* environment variables (§14.3)');
    }
    return new R2Storage({ accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl });
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
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly audit: AuditService,
  ) {}

  /** Every asset a subdomain needs, for the client preloader (§11.4). */
  async manifestForSubdomain(id: string) {
    const subdomain = await this.content.getForPlay(id);
    const plugin = registry.get(subdomain.gameType);
    return plugin.assetsOf(subdomain.gameConfig as GameConfig);
  }

  /** Store one content asset and return the URL to reference from a gameConfig (§14.3). */
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
    await this.audit.record(principal.sub, 'media.upload', 'Asset', key);
    return { url, key, kind: file.mimetype.startsWith('audio/') ? 'audio' : 'image' };
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

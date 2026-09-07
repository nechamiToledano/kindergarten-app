import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDefaultRegistry } from '@kga/game-engine';
import type { GameConfig } from '@kga/contracts';
import type { Env } from '../config/env.js';
import { ContentService } from '../content/content.service.js';
import { ContentModule } from '../content/content.module.js';
import { Public } from '../common/auth.js';

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
    throw new Error('StaticAssetStorage is read-only; register R2Storage to upload (§14.3)');
  }
}

const registry = createDefaultRegistry();

@Injectable()
export class MediaService {
  constructor(private readonly content: ContentService) {}

  /** Every asset a subdomain needs, for the client preloader (§11.4). */
  async manifestForSubdomain(id: string) {
    const subdomain = await this.content.getForPlay(id);
    const plugin = registry.get(subdomain.gameType);
    return plugin.assetsOf(subdomain.gameConfig as GameConfig);
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
}

@Module({
  imports: [ContentModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    StaticAssetStorage,
    { provide: STORAGE_PORT, useExisting: StaticAssetStorage },
  ],
  exports: [STORAGE_PORT, MediaService],
})
export class MediaModule {}

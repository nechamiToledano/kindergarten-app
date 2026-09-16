import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SettingKey } from '@kga/contracts';
import { SettingsService } from '../settings/settings.service.js';

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RATE_LIMIT_SETTING_KEY = 'rateLimitSetting';

/** Declares a per-IP request budget for one route, fixed in code. */
export const Throttle = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimit);

/**
 * Declares a per-IP request budget backed by an admin-editable setting (M11)
 * — its schema must be `RateLimitConfigSchema`. Use for routes worth guessing
 * against, where a NETWORK_ADMIN may reasonably want to tighten or loosen the
 * throttle without a deploy.
 */
export const ThrottleSetting = (key: SettingKey) => SetMetadata(RATE_LIMIT_SETTING_KEY, key);

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * M10 §3 — a per-IP budget on the routes worth guessing against, `POST /auth/login`
 * above all. Until now an attacker could try passwords at whatever rate the
 * network allowed; argon2 makes each attempt expensive for the *server*, which
 * turns an unthrottled login into a denial-of-service lever as well.
 *
 * In-memory on purpose: this is one Node process today, and a Redis-backed
 * limiter is a deployment decision, not a code one. If the API is ever run with
 * more than one replica this must move behind a shared store — the seam is the
 * `buckets` map and nothing else.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly settings: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const settingKey = this.reflector.getAllAndOverride<SettingKey | undefined>(
      RATE_LIMIT_SETTING_KEY,
      [context.getHandler(), context.getClass()],
    );
    const staticConfig = this.reflector.getAllAndOverride<RateLimit | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // ThrottleSetting's contract is "this key's schema is RateLimitConfigSchema" —
    // not expressible in SettingKey itself, so the cast is the seam.
    const config = settingKey
      ? ((await this.settings.get(settingKey)) as unknown as RateLimit)
      : staticConfig;
    if (!config) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    this.sweep(now);

    const key = `${context.getClass().name}.${context.getHandler().name}:${req.ip ?? 'unknown'}`;
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + config.windowMs });
      return true;
    }
    if (bucket.count >= config.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        { statusCode: 429, error: 'TooManyRequests', message: `Try again in ${retryAfter}s`, retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    bucket.count += 1;
    return true;
  }

  /** Drop expired buckets occasionally so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

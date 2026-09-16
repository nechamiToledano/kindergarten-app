import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: true, credentials: true });
  // Every response here is tenant-scoped, session-live data — Express's default
  // ETag would let the browser conditionally-cache a GET and later replay a
  // 304 for state that has since changed server-side (e.g. session progress
  // after a plan item completes), leaving the client stuck on stale data.
  app.set('etag', false);
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Request validation is per-route via ZodBody (src/common/zod-validation.pipe.ts,
  // §3.2/§10.2) — no global class-validator pipe.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

await bootstrap();

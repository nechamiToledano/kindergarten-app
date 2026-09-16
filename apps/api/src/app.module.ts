import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { JwtAuthGuard, RolesGuard } from './common/auth.js';
import { RateLimitGuard } from './common/rate-limit.guard.js';
import { AuditModule } from './common/audit.module.js';
import { ClockModule } from './common/clock.js';
import { HealthController } from './common/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AnalyticsModule } from './analytics/analytics.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { ChildrenModule } from './children/children.module.js';
import { ContentModule } from './content/content.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { MediaModule } from './media/media.module.js';
import { SettingsCoreModule } from './settings/settings.service.js';
import { SettingsModule } from './settings/settings.module.js';
import { NetworksModule } from './networks/networks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        // No child PII in logs (§10.4, §13.3).
        redact: ['req.headers.authorization', '*.displayName', '*.email', '*.teacherNote'],
        transport:
          process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    PrismaModule,
    ClockModule,
    AuditModule,
    SettingsCoreModule,
    AnalyticsModule,
    IdentityModule,
    TenancyModule,
    NetworksModule,
    ChildrenModule,
    ContentModule,
    SessionsModule,
    ReportsModule,
    MediaModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Ordered: budget first, so a flood of guesses never reaches argon2.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

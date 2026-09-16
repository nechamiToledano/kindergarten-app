import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogQuerySchema } from '@kga/contracts';
import { Roles } from './auth.js';
import { AuditService } from './audit.service.js';

/** M11 — network-wide change log, for oversight of everything the admin app can mutate. */
@Controller({ path: 'audit', version: '1' })
@Roles('NETWORK_ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.audit.list(AuditLogQuerySchema.parse(query));
  }
}

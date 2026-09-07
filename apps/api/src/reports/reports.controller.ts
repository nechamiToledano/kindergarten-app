import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExportFormatSchema, type Principal } from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ReportsService } from './reports.service.js';
import { ExportService } from './export.service.js';

@Controller({ path: 'reports', version: '1' })
@Roles('TEACHER', 'KINDERGARTEN_ADMIN', 'NETWORK_ADMIN')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ExportService,
  ) {}

  @Get('children/:childId/progression')
  progression(@CurrentUser() principal: Principal, @Param('childId') childId: string) {
    return this.reports.childProgression(principal, childId);
  }

  @Get('children/:childId/vs-group')
  vsGroup(@CurrentUser() principal: Principal, @Param('childId') childId: string) {
    return this.reports.childVsGroup(principal, childId);
  }

  @Get('subdomains/:subdomainId/patterns')
  patterns(@CurrentUser() principal: Principal, @Param('subdomainId') subdomainId: string) {
    return this.reports.crossChildPatterns(principal, subdomainId);
  }

  @Get('children/:childId/progression/export')
  async exportProgression(
    @CurrentUser() principal: Principal,
    @Param('childId') childId: string,
    @Query('format') format?: string,
  ) {
    const fmt = ExportFormatSchema.parse(format ?? 'pdf');
    const data = await this.reports.childProgression(principal, childId);
    return this.exporter.export(`progression-${childId}`, fmt, data);
  }
}

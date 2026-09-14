import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportFormatSchema, type ExportFormat, type Principal } from '@kga/contracts';
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

  @Get('subdomains')
  reportSubdomains(@CurrentUser() principal: Principal) {
    return this.reports.listReportSubdomains(principal);
  }

  /** M7 §3.1 — home-dashboard summary. */
  @Get('kindergarten/summary')
  summary(@CurrentUser() principal: Principal) {
    return this.reports.kindergartenSummary(principal);
  }

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
    @Res() res: Response,
    @CurrentUser() principal: Principal,
    @Param('childId') childId: string,
    @Query('format') format?: string,
  ) {
    const data = await this.reports.childProgression(principal, childId);
    this.send(res, `progression-${childId}`, this.fmt(format), data);
  }

  @Get('children/:childId/vs-group/export')
  async exportVsGroup(
    @Res() res: Response,
    @CurrentUser() principal: Principal,
    @Param('childId') childId: string,
    @Query('format') format?: string,
  ) {
    const data = await this.reports.childVsGroup(principal, childId);
    this.send(res, `vs-group-${childId}`, this.fmt(format), data);
  }

  @Get('subdomains/:subdomainId/patterns/export')
  async exportPatterns(
    @Res() res: Response,
    @CurrentUser() principal: Principal,
    @Param('subdomainId') subdomainId: string,
    @Query('format') format?: string,
  ) {
    const data = await this.reports.crossChildPatterns(principal, subdomainId);
    this.send(res, `patterns-${subdomainId}`, this.fmt(format), data);
  }

  private fmt(format?: string): ExportFormat {
    return ExportFormatSchema.parse(format ?? 'pdf');
  }

  private send(res: Response, name: string, format: ExportFormat, data: unknown): void {
    const out = this.exporter.export(name, format, data);
    res.set({
      'Content-Type': out.contentType,
      'Content-Disposition': `attachment; filename="${out.filename}"`,
    });
    res.send(Buffer.from(out.body, 'base64'));
  }
}

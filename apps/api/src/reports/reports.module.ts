import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { ExportService, JsonExportAdapter } from './export.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ExportService, JsonExportAdapter],
  exports: [ReportsService],
})
export class ReportsModule {}

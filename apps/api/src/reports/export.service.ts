import { Injectable } from '@nestjs/common';
import type { ExportFormat } from '@kga/contracts';
import { renderPdf } from './adapters/pdf-export.adapter.js';
import { toReportDocument } from './adapters/report-document.js';
import { renderXlsx } from './adapters/xlsx-export.adapter.js';

export const EXPORT_PORT = Symbol('ExportPort');

export interface ExportResult {
  filename: string;
  contentType: string;
  /** base64-encoded body — small enough to inline for the MVP (§10.3). */
  body: string;
}

export interface ExportPort {
  export(name: string, format: ExportFormat, data: unknown): Promise<ExportResult>;
}

/**
 * Real PDF/Excel adapter (§10.3), behind the same port the MVP JSON stub
 * used — swapping it in was a config/DI change, no call-site change, exactly
 * as the port was designed for. `toReportDocument` recovers which of the
 * three report shapes `data` is; both renderers share that one table layout.
 */
@Injectable()
export class ReportExportAdapter implements ExportPort {
  async export(name: string, format: ExportFormat, data: unknown): Promise<ExportResult> {
    const doc = toReportDocument(data);
    if (format === 'xlsx') {
      const body = await renderXlsx(doc);
      return {
        filename: `${name}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: body.toString('base64'),
      };
    }
    const body = await renderPdf(doc);
    return {
      filename: `${name}.pdf`,
      contentType: 'application/pdf',
      body: body.toString('base64'),
    };
  }
}

@Injectable()
export class ExportService {
  constructor(private readonly adapter: ReportExportAdapter) {}

  export(name: string, format: ExportFormat, data: unknown): Promise<ExportResult> {
    return this.adapter.export(name, format, data);
  }
}

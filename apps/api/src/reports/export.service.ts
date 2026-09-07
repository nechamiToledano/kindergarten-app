import { Injectable } from '@nestjs/common';
import type { ExportFormat } from '@kga/contracts';

export const EXPORT_PORT = Symbol('ExportPort');

export interface ExportResult {
  filename: string;
  contentType: string;
  /** base64-encoded body — small enough to inline for the MVP (§10.3). */
  body: string;
}

export interface ExportPort {
  export(name: string, format: ExportFormat, data: unknown): ExportResult;
}

/**
 * MVP adapter (§10.3): emits JSON payloads with the target extension so the
 * endpoint contract is stable. Swap for a real PDF/Excel adapter — or a queue —
 * behind this same port with no call-site change.
 */
@Injectable()
export class JsonExportAdapter implements ExportPort {
  export(name: string, format: ExportFormat, data: unknown): ExportResult {
    const contentType = format === 'xlsx' ? 'application/vnd.ms-excel' : 'application/pdf';
    return {
      filename: `${name}.${format}`,
      contentType,
      body: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    };
  }
}

@Injectable()
export class ExportService {
  constructor(private readonly adapter: JsonExportAdapter) {}

  export(name: string, format: ExportFormat, data: unknown): ExportResult {
    return this.adapter.export(name, format, data);
  }
}

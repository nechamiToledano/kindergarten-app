import { createHash, createHmac } from 'node:crypto';
import type { StoragePort } from './media.module.js';

export interface S3CompatibleOptions {
  host: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Adapter for any S3-compatible object store (Cloudflare R2, Backblaze B2, …)
 * (§14.3). A single signed `PUT` object is all we need — hand-rolled SigV4
 * keeps the dependency surface at zero, consistent with the rest of the
 * codebase. Registered in place of {@link StaticAssetStorage} by configuration
 * alone (`STORAGE_DRIVER=r2` or `b2`); no call site changes (§3.3).
 */
export class S3CompatibleStorage implements StoragePort {
  constructor(private readonly opts: S3CompatibleOptions) {}

  getUrl(key: string): string {
    const base = this.opts.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key.replace(/^\//, '')}`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const { host, region } = this.opts;
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const canonicalUri =
      `/${this.opts.bucket}/` + key.split('/').map(encodeURIComponent).join('/');
    const payloadHash = sha256hex(data);
    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256hex(canonicalRequest),
    ].join('\n');

    const kDate = hmac(`AWS4${this.opts.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning)
      .update(stringToSign, 'utf8')
      .digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.opts.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(`https://${host}${canonicalUri}`, {
      method: 'PUT',
      headers: {
        'content-type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        authorization,
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new Error(`Object storage upload failed: ${res.status} ${await res.text()}`);
    }
    return this.getUrl(key);
  }
}

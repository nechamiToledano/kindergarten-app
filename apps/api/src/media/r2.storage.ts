import { createHash, createHmac } from 'node:crypto';
import type { StoragePort } from './media.module.js';

export interface R2Options {
  accountId: string;
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
 * Cloudflare R2 adapter (§14.3). R2 speaks the S3 API, so a single signed
 * `PUT` object is all we need — hand-rolled SigV4 keeps the dependency surface
 * at zero, consistent with the rest of the codebase. Registered in place of
 * {@link StaticAssetStorage} by configuration alone (`STORAGE_DRIVER=r2`); no
 * call site changes (§3.3).
 */
export class R2Storage implements StoragePort {
  constructor(private readonly opts: R2Options) {}

  private get host(): string {
    return `${this.opts.accountId}.r2.cloudflarestorage.com`;
  }

  getUrl(key: string): string {
    const base = this.opts.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key.replace(/^\//, '')}`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const canonicalUri =
      `/${this.opts.bucket}/` + key.split('/').map(encodeURIComponent).join('/');
    const payloadHash = sha256hex(data);
    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${this.host}\n` +
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

    const res = await fetch(`https://${this.host}${canonicalUri}`, {
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
      throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
    }
    return this.getUrl(key);
  }
}

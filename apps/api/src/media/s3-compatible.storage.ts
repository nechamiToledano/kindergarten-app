import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { StoragePort } from './media.module.js';

export interface S3CompatibleOptions {
  host: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const EMPTY_PAYLOAD_HASH = createHash('sha256').update('').digest('hex');

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Adapter for any S3-compatible object store (Cloudflare R2, Backblaze B2, …)
 * (§14.3). Hand-rolled SigV4 keeps the dependency surface at zero, consistent
 * with the rest of the codebase. Registered in place of {@link
 * StaticAssetStorage} by configuration alone (`STORAGE_DRIVER=r2` or `b2`); no
 * call site changes (§3.3).
 *
 * The bucket stays **private** — a public bucket on B2 requires a credit card
 * on file, which this project avoids. `getUrl` instead points at
 * `MediaController`'s `/media/file/:key` proxy, which fetches the object with
 * a signed request using these same credentials and streams it back. Assets
 * are non-sensitive (game/content images and audio), so that route is public.
 */
export class S3CompatibleStorage implements StoragePort {
  constructor(private readonly opts: S3CompatibleOptions) {}

  getUrl(key: string): string {
    return `/api/v1/media/file/${encodeURIComponent(key)}`;
  }

  private canonicalUri(key: string): string {
    return `/${this.opts.bucket}/` + key.split('/').map(encodeURIComponent).join('/');
  }

  /** SigV4-signs a request and returns the headers to send alongside it. */
  private sign(
    method: 'PUT' | 'GET',
    canonicalUri: string,
    payloadHash: string,
    contentType?: string,
  ): Record<string, string> {
    const { host, region, accessKeyId, secretAccessKey } = this.opts;
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const headerPairs = [
      ...(contentType ? [['content-type', contentType]] : []),
      ['host', host],
      ['x-amz-content-sha256', payloadHash],
      ['x-amz-date', amzDate],
    ] as const;
    const canonicalHeaders = headerPairs.map(([k, v]) => `${k}:${v}\n`).join('');
    const signedHeaders = headerPairs.map(([k]) => k).join(';');
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join(
      '\n',
    );

    const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...(contentType ? { 'content-type': contentType } : {}),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    };
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const canonicalUri = this.canonicalUri(key);
    const payloadHash = sha256hex(data);
    const headers = this.sign('PUT', canonicalUri, payloadHash, contentType);

    const res = await fetch(`https://${this.opts.host}${canonicalUri}`, {
      method: 'PUT',
      headers,
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new Error(`Object storage upload failed: ${res.status} ${await res.text()}`);
    }
    return this.getUrl(key);
  }

  async get(key: string): Promise<{ body: Readable; contentType: string }> {
    const canonicalUri = this.canonicalUri(key);
    const headers = this.sign('GET', canonicalUri, EMPTY_PAYLOAD_HASH);

    const res = await fetch(`https://${this.opts.host}${canonicalUri}`, { method: 'GET', headers });
    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }
    if (!res.ok || !res.body) {
      throw new Error(`Object storage fetch failed: ${res.status} ${await res.text()}`);
    }
    return {
      body: Readable.fromWeb(res.body as never),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  }
}

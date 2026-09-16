import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { S3CompatibleStorage } from '../src/media/s3-compatible.storage.js';

/**
 * One-off migration (§14.3): uploads every file under `apps/web/public/assets`
 * to the configured object store, catalogues each as a `MediaAsset` (so it
 * shows up in the admin library for reuse), and rewrites every `/assets/...`
 * reference inside `Subdomain.gameConfig` / `demoConfig` to the new
 * `/api/v1/media/file/:key` URL. Historical `SubdomainVersion` snapshots are
 * left untouched — they're an immutable record of what a past result was
 * scored against, not live content.
 *
 * Defaults to a dry run (prints what it would do, touches nothing). Pass
 * `--apply` to actually upload files and write to the database.
 *
 *   pnpm --filter @kga/api migrate:assets-to-b2            # dry run
 *   pnpm --filter @kga/api migrate:assets-to-b2 -- --apply # for real
 */

const ASSETS_DIR = join(import.meta.dirname, '..', '..', 'web', 'public', 'assets');
const CONTENT_TS = join(import.meta.dirname, 'content.ts');
const APPLY = process.argv.includes('--apply');

// Only migrate files actually referenced by seeded content — apps/web/public/assets
// also holds unreferenced drafts (e.g. a stray `audios/` folder of voice-over
// exports with spaces/dashes in their names that this S3-compatible API's URL
// parsing chokes on), which nothing links to and so aren't worth fighting for.
const contentSource = readFileSync(CONTENT_TS, 'utf8');

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [relative(base, full)];
  });
}

function storageFromEnv(): S3CompatibleStorage {
  const { B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_REGION } = process.env;
  if (B2_KEY_ID && B2_APPLICATION_KEY && B2_BUCKET && B2_REGION) {
    return new S3CompatibleStorage({
      host: `s3.${B2_REGION}.backblazeb2.com`,
      region: B2_REGION,
      accessKeyId: B2_KEY_ID,
      secretAccessKey: B2_APPLICATION_KEY,
      bucket: B2_BUCKET,
    });
  }
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    return new S3CompatibleStorage({
      host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      bucket: R2_BUCKET,
    });
  }
  throw new Error(
    'Set B2_KEY_ID/B2_APPLICATION_KEY/B2_BUCKET/B2_REGION (or the R2_* equivalents) before running this script',
  );
}

function replaceAll(json: string, mapping: Map<string, string>): string {
  let out = json;
  for (const [oldPath, newUrl] of mapping) out = out.split(oldPath).join(newUrl);
  return out;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const storage = storageFromEnv();
  const files = walk(ASSETS_DIR)
    .map((rel) => rel.split(sep).join('/'))
    .sort();
  console.log(`Found ${files.length} files under apps/web/public/assets${APPLY ? '' : ' (dry run)'}`);

  const mapping = new Map<string, string>();

  for (const rel of files) {
    const mimeType = MIME_BY_EXT[extname(rel).toLowerCase()];
    if (!mimeType) {
      console.warn(`  skip (unsupported type): ${rel}`);
      continue;
    }
    const oldPath = `/assets/${rel}`;
    if (!contentSource.includes(oldPath)) {
      console.warn(`  skip (not referenced by content.ts): ${rel}`);
      continue;
    }
    const key = `seed/${rel}`;
    const newUrl = `/api/v1/media/file/${encodeURIComponent(key)}`;
    mapping.set(oldPath, newUrl);

    if (!APPLY) {
      console.log(`  would upload ${oldPath} -> ${newUrl}`);
      continue;
    }
    // Resumable: a prior run may have already uploaded this key before failing later on.
    if (await prisma.mediaAsset.findUnique({ where: { key }, select: { id: true } })) {
      console.log(`  already uploaded, skipping ${oldPath}`);
      continue;
    }
    const data = readFileSync(join(ASSETS_DIR, rel.split('/').join(sep)));

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await storage.put(key, data, mimeType);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`  attempt ${attempt}/3 failed for ${oldPath}: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    if (lastErr) throw lastErr;

    await prisma.mediaAsset.upsert({
      where: { key },
      update: {},
      create: {
        key,
        url: newUrl,
        kind: mimeType.startsWith('audio/') ? 'audio' : 'image',
        mimeType,
        sizeBytes: data.length,
        originalName: rel,
      },
    });
    console.log(`  uploaded ${oldPath} -> ${newUrl}`);
  }

  const subdomains = await prisma.subdomain.findMany({
    select: { id: true, name: true, gameConfig: true, demoConfig: true },
  });
  let changed = 0;
  for (const s of subdomains) {
    const originalGame = JSON.stringify(s.gameConfig);
    const originalDemo = s.demoConfig !== null ? JSON.stringify(s.demoConfig) : null;
    const rewrittenGame = replaceAll(originalGame, mapping);
    const rewrittenDemo = originalDemo !== null ? replaceAll(originalDemo, mapping) : null;
    if (rewrittenGame === originalGame && rewrittenDemo === originalDemo) continue;

    changed++;
    console.log(`${APPLY ? 'updating' : 'would update'} subdomain "${s.name}" (${s.id})`);
    if (APPLY) {
      await prisma.subdomain.update({
        where: { id: s.id },
        data: {
          gameConfig: JSON.parse(rewrittenGame),
          ...(rewrittenDemo !== null ? { demoConfig: JSON.parse(rewrittenDemo) } : {}),
        },
      });
    }
  }

  console.log(`\n${changed} subdomain(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  if (!APPLY) console.log('Re-run with -- --apply to actually upload files and update the database.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

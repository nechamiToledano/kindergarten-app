import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AssetRef } from '@kga/contracts';
import { isToneUrl } from './placeholder';

/**
 * §11.4 — before a subdomain begins, `plugin.assetsOf(config)` yields every image
 * and audio file it needs; all are fetched and decoded up front so there is no
 * mid-exercise stall while a child waits. Placeholder `tone:` audio (M2) needs no
 * fetch and is treated as instantly ready.
 */
type PreloadStatus = 'loading' | 'ready' | 'error';

function preloadOne(asset: AssetRef): Promise<void> {
  if (asset.kind === 'audio') {
    if (isToneUrl(asset.url)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const el = new Audio();
      el.preload = 'auto';
      el.addEventListener('canplaythrough', () => resolve(), { once: true });
      el.addEventListener('error', () => reject(new Error(`audio: ${asset.url}`)), { once: true });
      el.src = asset.url;
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => reject(new Error(`image: ${asset.url}`)), { once: true });
    img.src = asset.url;
    if (img.decode) void img.decode().then(resolve).catch(() => resolve());
  });
}

export function useAssetPreload(assets: AssetRef[]): PreloadStatus {
  const [status, setStatus] = useState<PreloadStatus>('loading');
  const key = assets.map((a) => `${a.kind}:${a.url}`).join('|');
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all(assets.map(preloadOne))
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return status;
}

export function AssetPreloader({
  assets,
  children,
  fallback,
}: {
  assets: AssetRef[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const status = useAssetPreload(assets);
  if (status === 'ready') return <>{children}</>;
  if (status === 'error') return <>{fallback ?? <p>שגיאה בטעינת התכנים</p>}</>;
  return <>{fallback ?? <p>טוען…</p>}</>;
}

/**
 * The admin app has no game-rendering UI of its own (§ two-surface design
 * rule — the play surface belongs to apps/web, styled for a child holding an
 * iPad). A "preview" here opens the web app's own preview route instead of
 * duplicating GamePlayer and its eight game components. Set VITE_WEB_APP_URL
 * in production; the localhost default matches apps/web's vite dev port.
 */
const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL ?? 'http://localhost:5173';

export function subdomainPreviewUrl(subdomainId: string): string {
  return `${WEB_APP_URL}/library/preview/${subdomainId}`;
}

/**
 * Some seed content still points at real files served from apps/web's own
 * `public/assets` (Content.ts: "wired in directly by URL" until they're moved
 * into the media library / B2). A root-relative path like that resolves fine
 * inside apps/web, but here in the admin app it'd resolve against the admin's
 * own origin and 404. Route it at the web app instead so the preview works.
 */
export function resolveAssetUrl(url: string): string {
  return url.startsWith('/') ? `${WEB_APP_URL}${url}` : url;
}

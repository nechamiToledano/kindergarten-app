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

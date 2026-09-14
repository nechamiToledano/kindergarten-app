/**
 * M2 (§17) runs entirely on placeholder assets — no real illustrations exist
 * yet (M7.6 is explicitly non-development, content-pipeline work). This
 * generator is what a child actually sees on screen today, so it earns real
 * design attention even as a stand-in: a tinted gradient card with two soft
 * "blob" highlights and a rounded sticker label, instead of a flat colour
 * swatch with text stamped on it. Deterministic in `seed`, inline SVG data
 * URI — no files, no network, no dependency.
 */

const SWATCHES: { base: string; tint: string }[] = [
  { base: '#2b3a67', tint: '#6879ac' }, // navy
  { base: '#e0602f', tint: '#f0946b' }, // coral
  { base: '#d99a2e', tint: '#efc272' }, // amber
  { base: '#2f8f5b', tint: '#75c295' }, // pine green
  { base: '#b23a3a', tint: '#dd8686' }, // brick
  { base: '#3e6e8e', tint: '#82adc7' }, // slate blue
];

function hashOf(seed: string): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** A tinted, labelled "sticker" card, deterministic in `seed`. */
export function placeholderImage(seed: string, label = seed): string {
  const hash = hashOf(seed);
  const { base, tint } = SWATCHES[hash % SWATCHES.length];
  const text = label.replace(/[<>&]/g, '').slice(0, 18);
  const gradId = `g${hash % 1000}`;
  const bx = 46 + (hash % 90);
  const by = 40 + ((hash >> 5) % 50);
  const br = 62 + ((hash >> 9) % 34);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${tint}"/>
        <stop offset="1" stop-color="${base}"/>
      </linearGradient>
    </defs>
    <rect width="240" height="240" rx="30" fill="url(#${gradId})"/>
    <circle cx="${bx}" cy="${by}" r="${br}" fill="#fff" opacity="0.16"/>
    <circle cx="${232 - bx * 0.55}" cy="${226 - by * 0.6}" r="${br * 0.55}" fill="#fff" opacity="0.12"/>
    <rect x="18" y="180" width="204" height="42" rx="21" fill="#fffdf9" opacity="0.96"/>
    <text x="120" y="207" font-family="Assistant, system-ui, sans-serif" font-size="20" font-weight="700"
      fill="${base}" text-anchor="middle">${text}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Placeholder prompt audio — a tone, not a recording (Spec §8 needs a human voice for real content). */
export function placeholderAudio(seed: string): string {
  return `tone:${encodeURIComponent(seed)}`;
}

export const isToneUrl = (url: string): boolean => url.startsWith('tone:');

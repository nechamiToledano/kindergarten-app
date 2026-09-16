import { createRequire } from 'node:module';
import type { Bidi } from 'bidi-js';

// bidi-js ships a CJS build with an ESM-shaped .d.ts, which NodeNext resolves
// inconsistently for a default import — require() sidesteps the mismatch.
const require = createRequire(import.meta.url);
const bidiFactory = require('bidi-js') as () => Bidi;
const bidi = bidiFactory();

/**
 * pdfkit draws glyphs left-to-right with no bidi support of its own. This
 * reorders a logical Hebrew/Latin/number string (e.g. "עברית 75%") into the
 * visual order pdfkit needs to render it correctly — required for every
 * string the PDF export adapter draws.
 */
export function toVisualOrder(text: string): string {
  if (!text) return text;
  const embeddingLevels = bidi.getEmbeddingLevels(text);
  return bidi.getReorderedString(text, embeddingLevels, 0, text.length);
}

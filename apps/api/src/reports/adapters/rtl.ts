/**
 * pdfkit's text layout (`EmbeddedFont.layout`, in pdfkit/js/pdfkit.js) splits a
 * string into chunks at each literal space/tab and shapes each chunk
 * independently through fontkit before drawing left-to-right. fontkit's own
 * shaping already resolves bidi *within* a chunk — a lone Hebrew word comes
 * out correctly mirrored — but pdfkit's chunk boundaries mean a multi-word
 * phrase never gets reordered as a whole, and each space-adjacent chunk gets
 * re-shaped on its own, scrambling word order and, for anything that isn't a
 * single word, individual letters too.
 *
 * Swapping the plain spaces for U+00A0 (present in this font) keeps pdfkit
 * from splitting the string at all, so the *entire* string goes through
 * fontkit's shaper as one run — which resolves bidi correctly, including
 * word order and mirrored brackets. Required for every string the PDF export
 * adapter draws.
 */
export function toVisualOrder(text: string): string {
  return text.replace(/ /g, ' ');
}

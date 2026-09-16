import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { ReportDocument, ReportTable } from './report-document.js';
import { toVisualOrder } from './rtl.js';

/**
 * Same Assistant family the app itself uses (apps/web/index.html), so an
 * exported report matches what the teacher sees on screen. Static TTF
 * instances (400/700), not the webfont's woff2 — fontkit's PDF embedding of
 * woff2 produces glyph outlines PDF renderers can't parse, which silently
 * yields a blank page. Regenerate with:
 *   python -m fontTools.varLib.instancer Assistant[wght].ttf wght=<400|700>
 */
const fontsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/fonts');
const REGULAR_FONT = path.join(fontsDir, 'Assistant-Regular.ttf');
const BOLD_FONT = path.join(fontsDir, 'Assistant-Bold.ttf');

const MARGIN = 48;
const ROW_HEIGHT = 22;

export function renderPdf(doc: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: MARGIN, size: 'A4' });
    pdf.registerFont('Assistant', REGULAR_FONT);
    pdf.registerFont('Assistant-Bold', BOLD_FONT);

    const chunks: Buffer[] = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const pageWidth = pdf.page.width - MARGIN * 2;

    pdf
      .font('Assistant-Bold')
      .fontSize(18)
      .text(toVisualOrder(doc.title), MARGIN, MARGIN, { align: 'right', width: pageWidth });
    pdf.moveDown(1.2);

    for (const table of doc.tables) {
      if (table.heading) {
        ensureSpace(pdf, ROW_HEIGHT);
        pdf
          .font('Assistant-Bold')
          .fontSize(13)
          .text(toVisualOrder(table.heading), MARGIN, pdf.y, { align: 'right', width: pageWidth });
        pdf.moveDown(0.5);
      }
      drawTable(pdf, table, pageWidth);
      pdf.moveDown(1);
    }

    pdf.end();
  });
}

function drawTable(pdf: PDFKit.PDFDocument, table: ReportTable, pageWidth: number): void {
  if (table.rows.length === 0) {
    pdf
      .font('Assistant')
      .fontSize(10)
      .fillColor('#666')
      .text(toVisualOrder('אין נתונים'), MARGIN, pdf.y, { align: 'right', width: pageWidth });
    pdf.fillColor('#000');
    return;
  }

  const columnCount = table.columns.length;
  const columnWidth = pageWidth / columnCount;
  // RTL layout: column 0 sits at the right edge, column 1 to its left, etc.
  const columnX = (index: number) => MARGIN + pageWidth - columnWidth * (index + 1);

  const drawRow = (cells: (string | number)[], font: string, y: number) => {
    pdf.font(font).fontSize(10);
    cells.forEach((cell, i) => {
      pdf.text(toVisualOrder(String(cell)), columnX(i), y, {
        width: columnWidth - 8,
        align: 'right',
      });
    });
  };

  ensureSpace(pdf, ROW_HEIGHT * 2);
  let y = pdf.y;
  drawRow(table.columns, 'Assistant-Bold', y);
  y += ROW_HEIGHT;
  pdf
    .moveTo(MARGIN, y - 4)
    .lineTo(MARGIN + pageWidth, y - 4)
    .strokeColor('#ccc')
    .stroke();

  for (const row of table.rows) {
    if (y + ROW_HEIGHT > pdf.page.height - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
    drawRow(row, 'Assistant', y);
    y += ROW_HEIGHT;
  }
  pdf.y = y;
}

function ensureSpace(pdf: PDFKit.PDFDocument, needed: number): void {
  if (pdf.y + needed > pdf.page.height - MARGIN) {
    pdf.addPage();
  }
}

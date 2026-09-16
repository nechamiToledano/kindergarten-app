import ExcelJS from 'exceljs';
import type { ReportDocument } from './report-document.js';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EDE8' },
};

export async function renderXlsx(doc: ReportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'תלם';
  workbook.created = new Date();

  doc.tables.forEach((table, index) => {
    const sheetName = (table.heading ?? `גיליון ${index + 1}`).slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });

    const titleRow = sheet.addRow([doc.title]);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, Math.max(table.columns.length, 1));
    titleRow.font = { bold: true, size: 14 };
    sheet.addRow([]);

    const headerRow = sheet.addRow(table.columns);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
    });

    if (table.rows.length === 0) {
      sheet.addRow(['אין נתונים']);
    } else {
      for (const row of table.rows) sheet.addRow(row);
    }

    sheet.columns.forEach((column) => {
      column.width = 22;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

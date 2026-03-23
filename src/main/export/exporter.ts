import * as fs from 'fs';
import * as path from 'path';

interface ExportOptions {
  columns?: string[];
  removeDuplicates?: boolean;
  filterStatus?: string;
}

function filterData(data: any[], options?: ExportOptions): any[] {
  let result = [...data];
  if (options?.removeDuplicates) {
    const seen = new Set<string>();
    result = result.filter((r) => {
      const key = r.email?.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return result;
}

function pickColumns(row: any, columns?: string[]): any {
  if (!columns || columns.length === 0) return row;
  const picked: any = {};
  for (const col of columns) {
    if (row[col] !== undefined) picked[col] = row[col];
  }
  return picked;
}

export async function exportToCSV(data: any[], filePath: string, options?: ExportOptions) {
  const filtered = filterData(data, options);
  if (filtered.length === 0) { fs.writeFileSync(filePath, ''); return; }
  const cols = options?.columns || Object.keys(filtered[0]);
  const header = cols.join(',');
  const rows = filtered.map((r) => {
    const picked = pickColumns(r, options?.columns);
    return cols.map((c) => `"${String(picked[c] || '').replace(/"/g, '""')}"`).join(',');
  });
  fs.writeFileSync(filePath, [header, ...rows].join('\n'), 'utf-8');
}

export async function exportToTXT(data: any[], filePath: string, options?: ExportOptions) {
  const filtered = filterData(data, options);
  const lines = filtered.map((r) => r.email || '');
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

export async function exportToXLSX(data: any[], filePath: string, options?: ExportOptions) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Extracted Emails');
  const filtered = filterData(data, options);
  if (filtered.length === 0) { await workbook.xlsx.writeFile(filePath); return; }
  const cols = options?.columns || Object.keys(filtered[0]);
  sheet.columns = cols.map((c: string) => ({ header: c.charAt(0).toUpperCase() + c.slice(1), key: c, width: 30 }));
  // Style header
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF00F0FF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  filtered.forEach((r) => sheet.addRow(pickColumns(r, options?.columns)));
  await workbook.xlsx.writeFile(filePath);
}

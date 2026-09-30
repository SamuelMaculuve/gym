/**
 * Exportação de tabelas para CSV, Excel e PDF, feita no browser.
 * As bibliotecas de Excel/PDF são carregadas apenas quando necessárias.
 */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Largura aproximada em caracteres (Excel). */
  width?: number;
}

export interface ExportOptions<T> {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV<T>({ filename, columns, rows }: ExportOptions<T>) {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ";" como separador e BOM UTF-8 para abrir correctamente no Excel em português
  const lines = [columns.map((c) => escape(c.header)).join(';'), ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(';'))];
  download(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

export async function exportExcel<T>({ filename, columns, rows }: ExportOptions<T>) {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const header = columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const }));
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = c.value(r);
      return typeof v === 'number' ? { type: Number, value: v } : { type: String, value: v === null || v === undefined ? '' : String(v) };
    }),
  );
  await writeXlsxFile([header, ...body], {
    fileName: `${filename}.xlsx`,
    columns: columns.map((c) => ({ width: c.width ?? Math.max(12, c.header.length + 2) })),
  });
}

export async function exportPDF<T>({ filename, title, subtitle, columns, rows }: ExportOptions<T>) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(15);
  doc.text(title, 40, 44);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(subtitle ?? `Gerado em ${new Date().toLocaleString('pt-PT')}`, 40, 60);
  autoTable(doc, {
    startY: 76,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(c.value(r) ?? ''))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [5, 150, 105] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${filename}.pdf`);
}

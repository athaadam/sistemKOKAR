const ExcelJS = require('exceljs');

function exportCsv(rows, cols, filename, res) {
  const header = cols.join(',');
  const lines = rows.map((row) =>
    cols
      .map((c) => {
        const v = row[c] ?? '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      })
      .join(','),
  );
  const body = [header, ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  return res.send('\uFEFF' + body);
}

async function exportXlsx(rows, cols, sheetTitle, filename, res) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetTitle);
  const hdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2744' } };
  const altFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3FF' } };
  const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EFDF' } };

  cols.forEach((col, ci) => {
    const cell = ws.getCell(1, ci + 1);
    cell.value = col.toUpperCase().replace(/_/g, ' ');
    cell.fill = hdrFill;
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { horizontal: 'center' };
    cell.border = thinBorder();
  });

  const skipTotal = new Set(['level', 'aktif', 'is_taxable', 'is_pkp', 'urut', 'max_loans']);
  const numCols = cols.filter((c) =>
    rows.slice(0, 5).some(
      (r) =>
        (typeof r[c] === 'number' || (typeof r[c] === 'string' && r[c] !== '' && !isNaN(r[c]))) &&
        !skipTotal.has(c),
    ),
  );

  rows.forEach((row, ri) => {
    cols.forEach((col, ci) => {
      const cell = ws.getCell(ri + 2, ci + 1);
      cell.value = row[col] ?? '';
      cell.border = thinBorder();
      if ((ri + 2) % 2 === 0) cell.fill = altFill;
      if (typeof cell.value === 'number' && !skipTotal.has(col)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  if (numCols.length && rows.length) {
    const tr = rows.length + 2;
    ws.getCell(tr, 1).value = 'TOTAL';
    ws.getCell(tr, 1).font = { bold: true };
    cols.forEach((col, ci) => {
      if (numCols.includes(col)) {
        const cell = ws.getCell(tr, ci + 1);
        cell.value = rows.reduce((s, r) => s + Number(r[col] || 0), 0);
        cell.font = { bold: true };
        cell.numFmt = '#,##0';
        cell.fill = totalFill;
      }
    });
  }

  ws.columns.forEach((col) => {
    let max = 8;
    col.eachCell?.({ includeEmpty: false }, (c) => {
      max = Math.max(max, String(c.value ?? '').length);
    });
    col.width = Math.min(max + 2, 40);
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  await wb.xlsx.write(res);
  res.end();
}

function thinBorder() {
  const s = { style: 'thin' };
  return { top: s, left: s, bottom: s, right: s };
}

function sendExport(fmt, rows, cols, sheetTitle, filename, res) {
  if (fmt === 'xlsx') return exportXlsx(rows, cols, sheetTitle, filename, res);
  return exportCsv(rows, cols, filename, res);
}

module.exports = { exportCsv, exportXlsx, sendExport };

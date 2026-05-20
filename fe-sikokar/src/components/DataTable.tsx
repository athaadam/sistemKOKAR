'use client';

import { fmtRp } from '@/lib/format';
import { api } from '@/lib/api';

export function DataTable({
  rows,
  exportPath,
  onRefresh,
}: {
  rows: Record<string, unknown>[];
  exportPath?: string;
  onRefresh?: () => void;
}) {
  if (!rows.length) {
    return <p className="text-muted">Tidak ada data.</p>;
  }

  const cols = Object.keys(rows[0]).filter((k) => !k.endsWith('_id') || k === 'id');

  function formatCell(key: string, val: unknown) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number' && (key.includes('total') || key.includes('saldo') || key.includes('nominal') || key.includes('harga') || key.includes('biaya') || key.includes('angsuran') || key.includes('pokok') || key.includes('gaji') || key.includes('fee') || key === 't' || key === 'jumlah')) {
      return `Rp ${fmtRp(val)}`;
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  return (
  <>
    <div className="toolbar d-flex gap-2 mb-2 flex-wrap">
      {exportPath && (
        <>
          <a className="btn btn-sm btn-outline-success" href={api.exportUrl(`${exportPath}?fmt=csv`)} target="_blank" rel="noreferrer">
            Export CSV
          </a>
          <a className="btn btn-sm btn-outline-success" href={api.exportUrl(`${exportPath}?fmt=xlsx`)} target="_blank" rel="noreferrer">
            Export Excel
          </a>
        </>
      )}
      {onRefresh && (
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRefresh}>
          Refresh
        </button>
      )}
    </div>
    <div className="tbl-wrap tbl-scroll-x">
      <table className="table table-sm table-hover mb-0">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {cols.map((c) => (
                <td key={c}>{formatCell(c, row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="text-muted small mt-2">{rows.length} baris</p>
  </>
  );
}

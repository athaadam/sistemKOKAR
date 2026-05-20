'use client';

import { api } from '@/lib/api';

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function ReportExportBar({
  exportPath,
  extra,
}: {
  exportPath: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="pg-hdr-right no-print d-flex flex-wrap gap-1 align-items-center">
      {extra}
      <a
        href={api.exportUrl(`${exportPath}&fmt=xlsx`)}
        className="btn btn-sm btn-outline-success"
        style={btnStyle}
        target="_blank"
        rel="noreferrer"
      >
        <i className="bi bi-file-earmark-excel me-1" />
        Excel
      </a>
      <a
        href={api.exportUrl(`${exportPath}&fmt=csv`)}
        className="btn btn-sm btn-outline-secondary"
        style={btnStyle}
        target="_blank"
        rel="noreferrer"
      >
        <i className="bi bi-download me-1" />
        CSV
      </a>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        style={btnStyle}
        onClick={() => window.print()}
      >
        <i className="bi bi-printer me-1" />
        Print
      </button>
    </div>
  );
}

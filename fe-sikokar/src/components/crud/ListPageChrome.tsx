'use client';

import { api } from '@/lib/api';

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function ListPageHeader({
  icon,
  title,
  subtitle,
  exportPath,
  onImport,
  onAdd,
  addLabel = 'Tambah',
}: {
  icon: string;
  title: string;
  subtitle: string;
  exportPath: string;
  onImport: () => void;
  onAdd: () => void;
  addLabel?: string;
}) {
  return (
    <div className="pg-hdr">
      <div className="pg-hdr-left">
        <h2>
          {icon} {title}
        </h2>
        <p>{subtitle}</p>
      </div>
      <div className="pg-hdr-right no-print">
        <a
          href={api.exportUrl(`${exportPath}?fmt=xlsx`)}
          className="btn btn-sm btn-outline-success"
          style={btnStyle}
          target="_blank"
          rel="noreferrer"
        >
          <i className="bi bi-file-earmark-excel me-1" />
          Excel
        </a>
        <a
          href={api.exportUrl(`${exportPath}?fmt=csv`)}
          className="btn btn-sm btn-outline-secondary"
          style={btnStyle}
          target="_blank"
          rel="noreferrer"
        >
          <i className="bi bi-download me-1" />
          CSV
        </a>
        <button type="button" className="btn btn-sm btn-outline-warning" style={btnStyle} onClick={onImport}>
          <i className="bi bi-upload me-1" />
          Import
        </button>
        <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
          <i className="bi bi-printer me-1" />
          Print
        </button>
        <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={onAdd}>
          <i className="bi bi-plus-lg me-1" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function ModalFooter({
  onCancel,
  onSubmit,
  saving,
  submitLabel = 'Simpan',
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  saving?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="modal-footer">
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>
        Batal
      </button>
      <button type="submit" className="btn btn-sm btn-navy" disabled={saving} onClick={onSubmit}>
        {saving ? 'Menyimpan...' : submitLabel}
      </button>
    </div>
  );
}

export function ImportModalBody({
  columns,
  file,
  onFile,
}: {
  columns: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  return (
    <>
      <p style={{ fontSize: 12, color: '#64748B' }}>
        Kolom: <code>{columns}</code>
      </p>
      <input
        type="file"
        accept=".csv"
        className="form-control form-control-sm"
        required
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {file && (
        <p className="text-muted small mt-1 mb-0">
          File: {file.name}
        </p>
      )}
    </>
  );
}

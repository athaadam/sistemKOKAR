'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ImportModalBody, ListPageHeader, ModalFooter } from '@/components/crud/ListPageChrome';
import { ICON_MAP } from '@/components/ui/IconRenderer';

type SupplierRow = {
  id: string;
  kode: string;
  nama: string;
  jenis?: string;
  is_pkp?: number;
  npwp?: string;
  alamat?: string;
  telp?: string;
  status?: string;
};

type SupplierForm = {
  id: string;
  nama: string;
  jenis: string;
  status: string;
  npwp: string;
  alamat: string;
  telp: string;
  is_pkp: boolean;
};

const EMPTY: SupplierForm = {
  id: '',
  nama: '',
  jenis: 'regular',
  status: 'aktif',
  npwp: '',
  alamat: '',
  telp: '',
  is_pkp: false,
};

function rowToForm(r: SupplierRow): SupplierForm {
  return {
    id: r.id,
    nama: r.nama || '',
    jenis: r.jenis || 'regular',
    status: r.status || 'aktif',
    npwp: r.npwp || '',
    alamat: r.alamat || '',
    telp: r.telp || '',
    is_pkp: r.is_pkp === 1,
  };
}

export default function SupplierPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [filterQ, setFilterQ] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Supplier');
  const [form, setForm] = useState<SupplierForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const query = filterQ ? `?q=${encodeURIComponent(filterQ)}` : '';
    api
      .get<{ rows: SupplierRow[] }>(`/supplier${query}`)
      .then((r) => setRows(r.rows || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterQ]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof SupplierForm>(key: K, value: SupplierForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateSupplierForm(): string | null {
    // Validasi NPWP hanya angka, min 10, max 21
    if (form.npwp) {
      if (!/^\d*$/.test(form.npwp)) {
        return 'NPWP hanya boleh berisi angka';
      }
      if (form.npwp.length < 10) {
        return 'NPWP minimal 10 angka';
      }
      if (form.npwp.length > 21) {
        return 'NPWP maksimal 21 angka';
      }
    }

    // Validasi telepon hanya angka, min 8, max 13
    if (form.telp) {
      if (!/^\d*$/.test(form.telp)) {
        return 'Telepon hanya boleh berisi angka';
      }
      if (form.telp.length < 8) {
        return 'Telepon minimal 8 angka';
      }
      if (form.telp.length > 13) {
        return 'Telepon maksimal 13 angka';
      }
    }

    return null;
  }

  function openAdd() {
    setModalTitle('Tambah Supplier');
    setForm({ ...EMPTY });
    setShowEdit(true);
  }

  function openEdit(row: SupplierRow) {
    setModalTitle(`Edit: ${row.nama}`);
    setForm(rowToForm(row));
    setShowEdit(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    
    const validationError = validateSupplierForm();
    if (validationError) {
      setFlash(validationError);
      setFlashType('danger');
      return;
    }

    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/supplier/save', {
        ...form,
        is_pkp: form.is_pkp ? 1 : 0,
      });
      setFlash(r.message || 'Data tersimpan');
      setFlashType('success');
      setShowEdit(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: SupplierRow) {
    if (!confirm('Hapus supplier?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/supplier/${row.id}`);
      setFlash(r.message || 'Supplier dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const r = await api.postForm<{ message?: string }>('/supplier/import', fd);
      setFlash(r.message || 'Import berhasil');
      setFlashType('success');
      setShowImport(false);
      setImportFile(null);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Import gagal');
      setFlashType('danger');
    } finally {
      setImporting(false);
    }
  }

  if (loading && !rows.length && !err) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <>
      {err && <Flash message={err} type="danger" />}
      {flash && <Flash message={flash} type={flashType} onClose={() => setFlash('')} />}

      <ListPageHeader
        icon={ICON_MAP.supplier_custom}
        title="Data Supplier"
        subtitle={`${rows.length} supplier`}
        exportPath="/supplier/export"
        onImport={() => setShowImport(true)}
        onAdd={openAdd}
        addLabel="Tambah"
      />

      <form
        className="toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          setFilterQ(q);
        }}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / kode..."
          className="form-control form-control-sm"
          style={{ width: 240, borderRadius: 6 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>
          <i className="bi bi-search me-1" />
          Cari
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          style={{ borderRadius: 6 }}
          onClick={() => {
            setQ('');
            setFilterQ('');
          }}
        >
          Reset
        </button>
      </form>

      <div className="tbl-wrap">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Supplier</th>
              <th>Jenis</th>
              <th>PKP</th>
              <th>NPWP</th>
              <th>Alamat</th>
              <th>Telp</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted py-4">
                  Belum ada data
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono">{r.kode}</span>
                  </td>
                  <td className="fw-semibold">{r.nama}</td>
                  <td>
                    <span className={`bd ${r.jenis === 'konsinyasi' ? 'bd-blue' : 'bd-gray'}`}>{r.jenis}</span>
                  </td>
                  <td>
                    {r.is_pkp ? (
                      <span className="bd bd-green">PKP</span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>{r.npwp || '—'}</td>
                  <td style={{ fontSize: 11, maxWidth: 180 }}>
                    {r.alamat || '—'}
                  </td>
                  <td style={{ fontSize: 11 }}>{r.telp || '—'}</td>
                  <td>
                    <span className={`bd ${r.status === 'aktif' ? 'bd-green' : 'bd-gray'}`}>{r.status}</span>
                  </td>
                  <td className="no-print">
                    <button
                      type="button"
                      className="btn btn-act btn-outline-primary me-1"
                      onClick={() => openEdit(r)}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button type="button" className="btn btn-act btn-outline-danger" onClick={() => onDelete(r)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={modalTitle} size="md">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-12">
                <label className="fl">Nama Supplier *</label>
                <input
                  value={form.nama}
                  onChange={(e) => setField('nama', e.target.value)}
                  className="form-control form-control-sm"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Jenis</label>
                <select
                  value={form.jenis}
                  onChange={(e) => setField('jenis', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="regular">Regular</option>
                  <option value="konsinyasi">Konsinyasi</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="aktif">Aktif</option>
                  <option value="tidak-aktif">Tidak Aktif</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">NPWP</label>
                <input
                  value={form.npwp}
                  onChange={(e) => setField('npwp', e.target.value.replace(/\D/g, ''))}
                  className="form-control form-control-sm"
                  placeholder="xx.xxx.xxx.x-xxx.xxx"
                  maxLength={21}
                />
              </div>
              <div className="col-md-6 d-flex align-items-end pb-1">
                <div className="form-check">
                  <input
                    type="checkbox"
                    id="f_is_pkp"
                    className="form-check-input"
                    checked={form.is_pkp}
                    onChange={(e) => setField('is_pkp', e.target.checked)}
                  />
                  <label htmlFor="f_is_pkp" className="form-check-label" style={{ fontSize: 12 }}>
                    Supplier PKP (wajib pungut PPN)
                  </label>
                </div>
              </div>
              <div className="col-12">
                <label className="fl">Alamat</label>
                <input
                  value={form.alamat}
                  onChange={(e) => setField('alamat', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Telepon</label>
                <input
                  value={form.telp}
                  onChange={(e) => setField('telp', e.target.value.replace(/\D/g, ''))}
                  className="form-control form-control-sm"
                  maxLength={13}
                />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Supplier (CSV)" size="md">
        <form onSubmit={onImport}>
          <div className="modal-body">
            <ImportModalBody
              columns="kode, nama, jenis, is_pkp, npwp, alamat, telp, status"
              file={importFile}
              onFile={setImportFile}
            />
          </div>
          <ModalFooter onCancel={() => setShowImport(false)} saving={importing} submitLabel="Import" />
        </form>
      </Modal>
    </>
  );
}

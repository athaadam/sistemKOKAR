'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ImportModalBody, ListPageHeader, ModalFooter } from '@/components/crud/ListPageChrome';

const TIPE_OPTIONS = ['aset', 'kewajiban', 'ekuitas', 'pendapatan', 'beban'] as const;

const TIPE_BADGE: Record<string, string> = {
  aset: 'bd-blue',
  kewajiban: 'bd-red',
  ekuitas: 'bd-purple',
  pendapatan: 'bd-green',
  beban: 'bd-amber',
};

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

type CoaRow = {
  id: string;
  kode: string;
  nama: string;
  tipe?: string;
  level?: number;
  status?: string;
  balance?: number;
};

type CoaForm = {
  id: string;
  kode: string;
  nama: string;
  tipe: string;
  level: string;
  status: string;
};

const EMPTY: CoaForm = {
  id: '',
  kode: '',
  nama: '',
  tipe: 'aset',
  level: '1',
  status: 'aktif',
};

function rowToForm(r: CoaRow): CoaForm {
  return {
    id: r.id,
    kode: r.kode || '',
    nama: r.nama || '',
    tipe: r.tipe || 'aset',
    level: String(r.level ?? 1),
    status: r.status || 'aktif',
  };
}

export default function CoaPage() {
  const [rows, setRows] = useState<CoaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [tipe, setTipe] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterTipe, setFilterTipe] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Akun');
  const [form, setForm] = useState<CoaForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filterQ) qs.set('q', filterQ);
    if (filterTipe) qs.set('tipe', filterTipe);
    const query = qs.toString() ? `?${qs}` : '';

    api
      .get<{ rows: CoaRow[] }>(`/coa${query}`)
      .then((r) => setRows(r.rows || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterQ, filterTipe]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof CoaForm>(key: K, value: CoaForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setModalTitle('Tambah Akun');
    setForm({ ...EMPTY });
    setShowEdit(true);
  }

  function openEdit(row: CoaRow) {
    setModalTitle(`Edit: ${row.nama}`);
    setForm(rowToForm(row));
    setShowEdit(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/coa/save', form);
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

  async function onDelete(row: CoaRow) {
    if (!confirm('Hapus akun?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/coa/${row.id}`);
      setFlash(r.message || 'COA dihapus');
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
      const r = await api.postForm<{ message?: string }>('/coa/import', fd);
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
        icon="📒"
        title="Chart of Accounts (COA)"
        subtitle={`${rows.length} akun`}
        exportPath="/coa/export"
        onImport={() => setShowImport(true)}
        onAdd={openAdd}
        addLabel="Tambah"
      />

      <form
        className="toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          setFilterQ(q);
          setFilterTipe(tipe);
        }}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kode / nama akun..."
          className="form-control form-control-sm"
          style={{ width: 220, borderRadius: 6 }}
        />
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value)}
          className="form-select form-select-sm"
          style={{ width: 130, borderRadius: 6 }}
        >
          <option value="">Semua Tipe</option>
          {TIPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {capitalize(t)}
            </option>
          ))}
        </select>
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
            setTipe('');
            setFilterQ('');
            setFilterTipe('');
          }}
        >
          Reset
        </button>
      </form>

      <div className="tbl-wrap">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>Kode Akun</th>
              <th>Nama Akun</th>
              <th>Tipe</th>
              <th className="text-end">Balance</th>
              <th>Level</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  Belum ada data COA
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono fw-bold">{r.kode}</span>
                  </td>
                  <td>{r.nama}</td>
                  <td>
                    <span className={`bd ${TIPE_BADGE[r.tipe || ''] || 'bd-gray'}`}>
                      {capitalize(r.tipe || '')}
                    </span>
                  </td>
                  <td className="text-end mono fw-semibold">Rp {fmtRp(r.balance)}</td>
                  <td style={{ fontSize: 11 }}>{r.level}</td>
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
              <div className="col-md-5">
                <label className="fl">Kode Akun *</label>
                <input
                  value={form.kode}
                  onChange={(e) => setField('kode', e.target.value)}
                  className="form-control form-control-sm"
                  placeholder="1-001"
                  required
                />
              </div>
              <div className="col-md-7">
                <label className="fl">Nama Akun *</label>
                <input
                  value={form.nama}
                  onChange={(e) => setField('nama', e.target.value)}
                  className="form-control form-control-sm"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Tipe</label>
                <select
                  value={form.tipe}
                  onChange={(e) => setField('tipe', e.target.value)}
                  className="form-select form-select-sm"
                >
                  {TIPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {capitalize(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="fl">Level</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.level}
                  onChange={(e) => setField('level', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-3">
                <label className="fl">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Non-Aktif</option>
                </select>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import COA (CSV)" size="md">
        <form onSubmit={onImport}>
          <div className="modal-body">
            <ImportModalBody columns="kode, nama, tipe, level, status" file={importFile} onFile={setImportFile} />
          </div>
          <ModalFooter onCancel={() => setShowImport(false)} saving={importing} submitLabel="Import" />
        </form>
      </Modal>
    </>
  );
}

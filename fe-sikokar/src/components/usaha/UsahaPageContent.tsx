'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';

type UsahaRow = {
  id: string;
  tgl: string;
  jenis: string;
  nama: string;
  customer: string;
  deskripsi?: string;
  pendapatan: number;
  biaya: number;
  laba: number;
  status: string;
};

type JenisOpt = { value: string; label: string };

type UsahaForm = {
  id: string;
  tgl: string;
  jenis: string;
  nama: string;
  customer: string;
  deskripsi: string;
  pendapatan: string;
  biaya: string;
  status: string;
};

const EMPTY: UsahaForm = {
  id: '',
  tgl: today(),
  jenis: 'catering',
  nama: '',
  customer: '',
  deskripsi: '',
  pendapatan: '0',
  biaya: '0',
  status: 'selesai',
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function UsahaPageContent() {
  const [rows, setRows] = useState<UsahaRow[]>([]);
  const [jenisOptions, setJenisOptions] = useState<JenisOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [showEdit, setShowEdit] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Usaha');
  const [form, setForm] = useState<UsahaForm>(EMPTY);
  const [jenisSel, setJenisSel] = useState('');
  const [jenisCustom, setJenisCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  const rowsMap = useMemo(() => {
    const m: Record<string, UsahaRow> = {};
    rows.forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [rows]);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: UsahaRow[]; jenis_options: JenisOpt[] }>('/usaha')
      .then((r) => {
        setRows(r.rows || []);
        setJenisOptions(r.jenis_options || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof UsahaForm>(key: K, value: UsahaForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setForm({ ...EMPTY, tgl: today() });
    setJenisSel('');
    setJenisCustom(false);
    setModalTitle('Tambah Usaha');
  }

  function openAdd() {
    resetForm();
    setShowEdit(true);
  }

  function openEdit(row: UsahaRow) {
    const opts = jenisOptions.map((o) => o.value);
    setForm({
      id: row.id,
      tgl: row.tgl,
      jenis: row.jenis,
      nama: row.nama || '',
      customer: row.customer || '',
      deskripsi: row.deskripsi || '',
      pendapatan: String(row.pendapatan || 0),
      biaya: String(row.biaya || 0),
      status: row.status || 'selesai',
    });
    if (row.jenis && opts.includes(row.jenis)) {
      setJenisSel(row.jenis);
      setJenisCustom(false);
    } else if (row.jenis) {
      setJenisSel('__tambah__');
      setJenisCustom(true);
    } else {
      setJenisSel('');
      setJenisCustom(false);
    }
    setModalTitle('Edit Usaha');
    setShowEdit(true);
  }

  function onJenisChange(val: string) {
    setJenisSel(val);
    if (val === '__tambah__') {
      setJenisCustom(true);
      setField('jenis', '');
    } else {
      setJenisCustom(false);
      setField('jenis', val);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/usaha', form);
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

  async function onDelete(row: UsahaRow) {
    if (!confirm('Hapus data?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/usaha/delete/${row.id}`);
      setFlash(r.message || 'Usaha dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
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

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>🍱 Catering / Usaha Lain</h2>
          <p>{rows.length} transaksi</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a
            href={api.exportUrl('/usaha/export')}
            className="btn btn-sm btn-outline-success"
            style={btnStyle}
            target="_blank"
            rel="noreferrer"
          >
            Export
          </a>
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Tambah
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Tgl</th>
              <th>Jenis</th>
              <th>Nama Usaha</th>
              <th>Customer</th>
              <th className="text-end">Pendapatan</th>
              <th className="text-end">Biaya</th>
              <th className="text-end">Laba</th>
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
                  <td>{r.tgl}</td>
                  <td>
                    <span className="bd bd-blue">{r.jenis}</span>
                  </td>
                  <td>{r.nama}</td>
                  <td>{r.customer}</td>
                  <td className="text-end mono">Rp {fmtRp(r.pendapatan)}</td>
                  <td className="text-end mono">Rp {fmtRp(r.biaya)}</td>
                  <td className="text-end mono fw-bold">Rp {fmtRp(r.laba)}</td>
                  <td>{r.status}</td>
                  <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn btn-act btn-outline-primary me-1"
                      onClick={() => openEdit(rowsMap[r.id] || r)}
                    >
                      <i className="bi bi-pencil" /> Edit
                    </button>
                    <button type="button" className="btn btn-act btn-outline-danger" onClick={() => onDelete(r)}>
                      <i className="bi bi-trash" /> Hapus
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
              <div className="col-md-6">
                <label className="fl">Tanggal</label>
                <input
                  type="date"
                  value={form.tgl}
                  onChange={(e) => setField('tgl', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Jenis Usaha</label>
                <select
                  value={jenisSel}
                  onChange={(e) => onJenisChange(e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="">— Pilih Jenis —</option>
                  {jenisOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value="__tambah__">➕ Tambah Jenis Baru...</option>
                </select>
                {jenisCustom && (
                  <input
                    value={form.jenis}
                    onChange={(e) => setField('jenis', e.target.value)}
                    className="form-control form-control-sm mt-1"
                    placeholder="Ketik jenis baru..."
                  />
                )}
              </div>
              <div className="col-12">
                <label className="fl">Nama Usaha / Kegiatan</label>
                <input
                  value={form.nama}
                  onChange={(e) => setField('nama', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-12">
                <label className="fl">Customer</label>
                <input
                  value={form.customer}
                  onChange={(e) => setField('customer', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Pendapatan</label>
                <input
                  type="number"
                  value={form.pendapatan}
                  onChange={(e) => setField('pendapatan', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Biaya</label>
                <input
                  type="number"
                  value={form.biaya}
                  onChange={(e) => setField('biaya', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-12">
                <label className="fl">Deskripsi</label>
                <textarea
                  value={form.deskripsi}
                  onChange={(e) => setField('deskripsi', e.target.value)}
                  className="form-control form-control-sm"
                  rows={2}
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="selesai">Selesai</option>
                  <option value="proses">Proses</option>
                </select>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type RefOption = { label: string };
type AnggotaRow = {
  id: string;
  no: string;
  nip?: string;
  nama: string;
  nik?: string;
  dept?: string;
  jabatan?: string;
  no_hp?: string;
  no_rek?: string;
  nama_bank?: string;
  gaji?: number;
  tgl_masuk?: string;
  tgl_lahir?: string;
  alamat?: string;
  status?: string;
  status_detail?: string;
  tgl_keluar?: string;
  alasan_keluar?: string;
  limit_kredit?: number;
  limit_pinjaman?: number;
  limit_darurat?: number;
  max_loans?: number;
  piutang?: number;
  total_simpanan?: number;
  pinjaman_aktif?: number;
};

type AnggotaForm = {
  id: string;
  no: string;
  nama: string;
  nip: string;
  nik: string;
  no_hp: string;
  tgl_lahir: string;
  alamat: string;
  no_rek: string;
  nama_bank: string;
  dept: string;
  jabatan: string;
  gaji: string;
  tgl_masuk: string;
  limit_kredit: string;
  limit_pinjaman: string;
  limit_darurat: string;
  max_loans: string;
  status: string;
  status_detail: string;
  tgl_keluar: string;
  alasan_keluar: string;
};

const BANKS = ['BRI', 'BNI', 'BCA', 'Mandiri', 'BTN', 'BSI', 'CIMB', 'Danamon'];

const EMPTY_FORM: AnggotaForm = {
  id: '',
  no: '',
  nama: '',
  nip: '',
  nik: '',
  no_hp: '',
  tgl_lahir: '',
  alamat: '',
  no_rek: '',
  nama_bank: '',
  dept: '',
  jabatan: '',
  gaji: '0',
  tgl_masuk: '',
  limit_kredit: '3000000',
  limit_pinjaman: '20000000',
  limit_darurat: '5000000',
  max_loans: '5',
  status: 'aktif',
  status_detail: 'aktif',
  tgl_keluar: '',
  alasan_keluar: '',
};

function toDateInput(val?: string) {
  if (!val) return '';
  return String(val).slice(0, 10);
}

function rowToForm(r: AnggotaRow): AnggotaForm {
  return {
    id: r.id || '',
    no: r.no || '',
    nama: r.nama || '',
    nip: r.nip || '',
    nik: r.nik || '',
    no_hp: r.no_hp || '',
    tgl_lahir: toDateInput(r.tgl_lahir),
    alamat: r.alamat || '',
    no_rek: r.no_rek || '',
    nama_bank: r.nama_bank || '',
    dept: r.dept || '',
    jabatan: r.jabatan || '',
    gaji: String(r.gaji ?? 0),
    tgl_masuk: toDateInput(r.tgl_masuk),
    limit_kredit: String(r.limit_kredit ?? 3000000),
    limit_pinjaman: String(r.limit_pinjaman ?? 20000000),
    limit_darurat: String(r.limit_darurat ?? 5000000),
    max_loans: String(r.max_loans ?? 5),
    status: r.status || 'aktif',
    status_detail: r.status_detail || r.status || 'aktif',
    tgl_keluar: toDateInput(r.tgl_keluar),
    alasan_keluar: r.alasan_keluar || '',
  };
}

export default function AnggotaPage() {
  const [rows, setRows] = useState<AnggotaRow[]>([]);
  const [masterDept, setMasterDept] = useState<RefOption[]>([]);
  const [masterJabatan, setMasterJabatan] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [dept, setDept] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Anggota');
  const [form, setForm] = useState<AnggotaForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filterQ) qs.set('q', filterQ);
    if (filterStatus) qs.set('status', filterStatus);
    if (filterDept) qs.set('dept', filterDept);
    const query = qs.toString() ? `?${qs}` : '';

    api
      .get<{
        rows: AnggotaRow[];
        master_dept: RefOption[];
        master_jabatan: RefOption[];
      }>(`/anggota${query}`)
      .then((r) => {
        setRows(r.rows || []);
        setMasterDept(r.master_dept || []);
        setMasterJabatan(r.master_jabatan || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterQ, filterStatus, filterDept]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setModalTitle('Tambah Anggota');
    setForm({ ...EMPTY_FORM });
    setShowEdit(true);
  }

  function openEdit(row: AnggotaRow) {
    setModalTitle('Edit Anggota');
    setForm(rowToForm(row));
    setShowEdit(true);
  }

  function setField<K extends keyof AnggotaForm>(key: K, value: AnggotaForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateAnggotaForm(): string | null {
    // Validasi NIP max 20 angka
    if (form.nip && !/^\d*$/.test(form.nip)) {
      return 'NIP hanya boleh berisi angka';
    }
    if (form.nip && form.nip.length > 20) {
      return 'NIP maksimal 20 angka';
    }

    // Validasi NIK 18 angka
    if (form.nik && !/^\d*$/.test(form.nik)) {
      return 'NIK hanya boleh berisi angka';
    }
    if (form.nik && form.nik.length !== 18) {
      return 'NIK harus 18 angka';
    }

    // Validasi tanggal lahir, masuk, keluar
    if (form.tgl_lahir && form.tgl_masuk && form.tgl_masuk < form.tgl_lahir) {
      return 'Tanggal masuk tidak boleh lebih awal dari tanggal lahir';
    }

    if (form.tgl_masuk && form.tgl_keluar && form.tgl_keluar < form.tgl_masuk) {
      return 'Tanggal keluar tidak boleh lebih awal dari tanggal masuk';
    }

    return null;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    
    const validationError = validateAnggotaForm();
    if (validationError) {
      setFlash(validationError);
      setFlashType('danger');
      return;
    }

    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/anggota/save', form);
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

  async function onDelete(row: AnggotaRow) {
    if (!confirm(`Hapus anggota ${row.nama}?\nData yang terkait akan ikut terhapus.`)) return;
    setFlash('');
    try {
      const r = await api.delete<{ message?: string }>(`/anggota/${row.id}`);
      setFlash(r.message || 'Anggota dihapus');
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
    setFlash('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const r = await api.postForm<{ message?: string }>('/anggota/import', fd);
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

  function onFilter(e: FormEvent) {
    e.preventDefault();
    setFilterQ(q);
    setFilterStatus(status);
    setFilterDept(dept);
  }

  function onReset() {
    setQ('');
    setStatus('');
    setDept('');
    setFilterQ('');
    setFilterStatus('');
    setFilterDept('');
  }

  if (loading && rows.length === 0 && !err) {
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
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.usersRound_custom} size={28} style={{ marginRight: 12 }} />
            Data Anggota
          </h2>
          <p>{rows.length} anggota ditemukan</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a
            href={api.exportUrl('/anggota/export?fmt=xlsx')}
            className="btn btn-sm btn-outline-success"
            style={{ borderRadius: 6, fontSize: 12 }}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-file-earmark-excel me-1" />
            Excel
          </a>
          <a
            href={api.exportUrl('/anggota/export?fmt=csv')}
            className="btn btn-sm btn-outline-secondary"
            style={{ borderRadius: 6, fontSize: 12 }}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-download me-1" />
            CSV
          </a>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={() => setShowImport(true)}
          >
            <i className="bi bi-upload me-1" />
            Import
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={() => window.print()}
          >
            <i className="bi bi-printer me-1" />
            Print
          </button>
          <button
            type="button"
            className="btn btn-sm btn-navy"
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={openAdd}
          >
            <i className="bi bi-plus-lg me-1" />
            Tambah Anggota
          </button>
        </div>
      </div>

      <form className="toolbar no-print" onSubmit={onFilter}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / no / NIP..."
          className="form-control form-control-sm"
          style={{ width: 220, borderRadius: 6 }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="form-select form-select-sm"
          style={{ width: 120, borderRadius: 6 }}
        >
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="non-aktif">Non-Aktif</option>
          <option value="keluar">Keluar</option>
          <option value="pensiun">Pensiun</option>
          <option value="meninggal">Meninggal</option>
        </select>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="form-select form-select-sm"
          style={{ width: 150, borderRadius: 6 }}
        >
          <option value="">Semua Dept</option>
          {masterDept.map((m) => (
            <option key={m.label} value={m.label}>
              {m.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>
          <i className="bi bi-search me-1" />
          Cari
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6 }} onClick={onReset}>
          Reset
        </button>
      </form>

      <div className="tbl-wrap tbl-scroll-x">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>No</th>
              <th>No Ang.</th>
              <th>NIP</th>
              <th>Nama</th>
              <th>Dept/Jabatan</th>
              <th>No HP</th>
              <th>No Rekening</th>
              <th>Bank</th>
              <th className="text-end">Simpanan</th>
              <th className="text-end">Piutang</th>
              <th>Pin.Aktif</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center text-muted py-4">
                  Belum ada data anggota
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-muted" style={{ fontSize: 11 }}>
                    {i + 1}
                  </td>
                  <td>
                    <span className="mono">{r.no}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {r.nip}
                    </span>
                  </td>
                  <td className="fw-semibold">{r.nama}</td>
                  <td style={{ fontSize: 11, color: '#64748B' }}>
                    {r.dept}
                    <br />
                    <span style={{ fontSize: 10 }}>{r.jabatan}</span>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.no_hp}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {r.no_rek || '—'}
                  </td>
                  <td style={{ fontSize: 11 }}>{r.nama_bank || '—'}</td>
                  <td className="text-end mono">Rp {fmtRp(r.total_simpanan)}</td>
                  <td className="text-end mono" style={{ color: (r.piutang || 0) > 0 ? '#DC2626' : undefined }}>
                    {(r.piutang || 0) > 0 ? `Rp ${fmtRp(r.piutang)}` : '—'}
                  </td>
                  <td className="text-center">
                    {(r.pinjaman_aktif || 0) > 0 ? (
                      <span className="bd bd-amber">{r.pinjaman_aktif}</span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`bd ${r.status === 'aktif' ? 'bd-green' : 'bd-gray'}`}>
                      {r.status_detail || r.status}
                    </span>
                  </td>
                  <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn btn-act btn-outline-primary me-1"
                      onClick={() => openEdit(r)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil" /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-act btn-outline-danger"
                      onClick={() => onDelete(r)}
                      title="Hapus"
                    >
                      <i className="bi bi-trash" /> Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showEdit && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{modalTitle}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowEdit(false)} aria-label="Tutup" />
                </div>
                <form onSubmit={onSave}>
                  <div className="modal-body">
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="fl">
                          No. Anggota <span style={{ color: '#94A3B8', fontSize: 10 }}>(kosong = auto)</span>
                        </label>
                        <input
                          value={form.no}
                          onChange={(e) => setField('no', e.target.value)}
                          className="form-control form-control-sm"
                          placeholder="mis: A-0011 atau EMP-001"
                        />
                      </div>
                      <div className="col-md-8">
                        <label className="fl">Nama Lengkap *</label>
                        <input
                          value={form.nama}
                          onChange={(e) => setField('nama', e.target.value)}
                          className="form-control form-control-sm"
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="fl">NIP</label>
                        <input
                          value={form.nip}
                          onChange={(e) => setField('nip', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="fl">NIK</label>
                        <input
                          value={form.nik}
                          onChange={(e) => setField('nik', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="fl">No HP</label>
                        <input
                          value={form.no_hp}
                          onChange={(e) => setField('no_hp', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="fl">Tanggal Lahir</label>
                        <input
                          type="date"
                          value={form.tgl_lahir}
                          onChange={(e) => setField('tgl_lahir', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-12">
                        <label className="fl">Alamat Lengkap</label>
                        <textarea
                          value={form.alamat}
                          onChange={(e) => setField('alamat', e.target.value)}
                          className="form-control form-control-sm"
                          rows={2}
                        />
                      </div>
                      <div className="col-md-5">
                        <label className="fl">No. Rekening Bank</label>
                        <input
                          value={form.no_rek}
                          onChange={(e) => setField('no_rek', e.target.value)}
                          className="form-control form-control-sm"
                          placeholder="contoh: 1234567890"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="fl">Nama Bank</label>
                        <select
                          value={form.nama_bank}
                          onChange={(e) => setField('nama_bank', e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="">— Pilih Bank —</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="fl">Departemen</label>
                        <select
                          value={form.dept}
                          onChange={(e) => setField('dept', e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="">— Pilih Departemen —</option>
                          {masterDept.map((m) => (
                            <option key={m.label} value={m.label}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted" style={{ fontSize: 10 }}>
                          Kelola daftar di Setting — Master Data
                        </small>
                      </div>
                      <div className="col-md-6">
                        <label className="fl">Jabatan</label>
                        <select
                          value={form.jabatan}
                          onChange={(e) => setField('jabatan', e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="">— Pilih Jabatan —</option>
                          {masterJabatan.map((m) => (
                            <option key={m.label} value={m.label}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted" style={{ fontSize: 10 }}>
                          Kelola daftar di Setting — Master Data
                        </small>
                      </div>
                      <div className="col-md-6">
                        <label className="fl">Gaji (Rp)</label>
                        <input
                          type="number"
                          value={form.gaji}
                          onChange={(e) => setField('gaji', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="fl">Tgl Masuk</label>
                        <input
                          type="date"
                          value={form.tgl_masuk}
                          onChange={(e) => setField('tgl_masuk', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Limit Kredit Toko</label>
                        <input
                          type="number"
                          value={form.limit_kredit}
                          onChange={(e) => setField('limit_kredit', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Limit Kredit Pinjaman</label>
                        <input
                          type="number"
                          value={form.limit_pinjaman}
                          onChange={(e) => setField('limit_pinjaman', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Limit Kredit Emergency</label>
                        <input
                          type="number"
                          value={form.limit_darurat}
                          onChange={(e) => setField('limit_darurat', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Max Pinjaman Aktif</label>
                        <input
                          type="number"
                          value={form.max_loans}
                          onChange={(e) => setField('max_loans', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setField('status', e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="aktif">Aktif</option>
                          <option value="non-aktif">Non-Aktif</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Status Detail</label>
                        <select
                          value={form.status_detail}
                          onChange={(e) => setField('status_detail', e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="aktif">Aktif</option>
                          <option value="keluar">Keluar</option>
                          <option value="pensiun">Pensiun</option>
                          <option value="meninggal">Meninggal</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="fl">Tanggal Keluar/Pensiun/Meninggal</label>
                        <input
                          type="date"
                          value={form.tgl_keluar}
                          onChange={(e) => setField('tgl_keluar', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-8">
                        <label className="fl">Alasan / Keterangan Status</label>
                        <input
                          value={form.alasan_keluar}
                          onChange={(e) => setField('alasan_keluar', e.target.value)}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowEdit(false)}>
                      Batal
                    </button>
                    <button type="submit" className="btn btn-sm btn-navy" disabled={saving}>
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}

      {showImport && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Import Anggota (CSV)</h5>
                  <button type="button" className="btn-close" onClick={() => setShowImport(false)} aria-label="Tutup" />
                </div>
                <form onSubmit={onImport}>
                  <div className="modal-body">
                    <p style={{ fontSize: 12, color: '#64748B' }}>
                      File CSV harus memiliki kolom:{' '}
                      <code>nama, nip, nik, dept, jabatan, no_hp, gaji, status, limit_kredit, limit_pinjaman, limit_darurat, max_loans</code>
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      className="form-control form-control-sm"
                      required
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                    <div className="mt-2 p-2" style={{ background: '#F8FAFC', borderRadius: 6, fontSize: 11, color: '#64748B' }}>
                      <b>Tips:</b> Export data dulu, edit di Excel, lalu import kembali. Encoding: UTF-8.
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowImport(false)}>
                      Batal
                    </button>
                    <button type="submit" className="btn btn-sm btn-navy" disabled={importing}>
                      {importing ? 'Mengupload...' : 'Upload & Import'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </>
  );
}

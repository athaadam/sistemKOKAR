'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type LaborKontrak = {
  id: string;
  no: string;
  tgl: string;
  klien: string;
  pekerjaan: string;
  lokasi: string;
  tgl_mulai: string;
  tgl_selesai: string;
  nilai_kontrak: number;
  jml_pekerja?: number;
  total_biaya?: number;
  laba_kotor?: number;
  pph21_total?: number;
  pph23?: number;
  laba_bersih?: number;
  status: string;
  catatan?: string;
};

type LaborPekerja = {
  id: string;
  nama: string;
  jabatan: string;
  nik: string;
  bulan: string;
  jumlah_orang: number;
  biaya: number;
  biaya_lembur: number;
  biaya_tambahan: number;
  total_biaya: number;
  pph21: number;
};

type PekerjaSummary = {
  manpower: number;
  lembur: number;
  tambahan: number;
  total: number;
};

const EMPTY_KONTRAK = {
  id: '',
  no: '',
  tgl: today(),
  klien: '',
  pekerjaan: '',
  lokasi: '',
  tgl_mulai: '',
  tgl_selesai: '',
  nilai_kontrak: '',
  status: 'aktif',
  catatan: '',
};

const EMPTY_PEKERJA = {
  id: '',
  nama: '',
  jabatan: '',
  nik: '',
  bulan: today().slice(0, 7),
  jumlah_orang: '1',
  biaya: '0',
  biaya_lembur: '0',
  biaya_tambahan: '0',
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

function calcPekerjaTotal(f: typeof EMPTY_PEKERJA) {
  const jml = Number(f.jumlah_orang) || 1;
  const biaya = Number(f.biaya) || 0;
  const lembur = Number(f.biaya_lembur) || 0;
  const tambahan = Number(f.biaya_tambahan) || 0;
  return (biaya + lembur + tambahan) * jml;
}

export function LaborPageContent() {
  const [rows, setRows] = useState<LaborKontrak[]>([]);
  const [totalKontrak, setTotalKontrak] = useState(0);
  const [totalLaba, setTotalLaba] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'danger'>('success');
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');

  const [showKontrak, setShowKontrak] = useState(false);
  const [kontrakForm, setKontrakForm] = useState(EMPTY_KONTRAK);
  const [savingKontrak, setSavingKontrak] = useState(false);

  const [showPekerja, setShowPekerja] = useState(false);
  const [pekerjaKontrakId, setPekerjaKontrakId] = useState('');
  const [pekerjaKontrakNo, setPekerjaKontrakNo] = useState('');
  const [pekerjaList, setPekerjaList] = useState<LaborPekerja[]>([]);
  const [pekerjaSummary, setPekerjaSummary] = useState<PekerjaSummary>({
    manpower: 0,
    lembur: 0,
    tambahan: 0,
    total: 0,
  });
  const [pekerjaForm, setPekerjaForm] = useState(EMPTY_PEKERJA);
  const [savingPekerja, setSavingPekerja] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{
        rows: LaborKontrak[];
        total_kontrak: number;
        total_laba: number;
      }>(
        `/labor?${new URLSearchParams({
          ...(appliedQ ? { q: appliedQ } : {}),
          ...(appliedStatus ? { status: appliedStatus } : {}),
        }).toString()}`,
      )
      .then((r) => {
        setRows(r.rows || []);
        setTotalKontrak(Number(r.total_kontrak) || 0);
        setTotalLaba(Number(r.total_laba) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [appliedQ, appliedStatus]);

  useEffect(() => {
    load();
  }, [load]);

  function openAddKontrak() {
    setKontrakForm({ ...EMPTY_KONTRAK, tgl: today() });
    setShowKontrak(true);
  }

  function openEditKontrak(row: LaborKontrak) {
    setKontrakForm({
      id: row.id,
      no: row.no,
      tgl: row.tgl,
      klien: row.klien || '',
      pekerjaan: row.pekerjaan || '',
      lokasi: row.lokasi || '',
      tgl_mulai: row.tgl_mulai || '',
      tgl_selesai: row.tgl_selesai || '',
      nilai_kontrak: String(row.nilai_kontrak || 0),
      status: row.status || 'aktif',
      catatan: row.catatan || '',
    });
    setShowKontrak(true);
  }

  async function onSaveKontrak(e: FormEvent) {
    e.preventDefault();
    if (!kontrakForm.klien.trim()) {
      setFlash('Klien harus diisi');
      setFlashType('danger');
      return;
    }
    setSavingKontrak(true);
    try {
      const r = await api.post<{ message?: string }>('/labor/save', {
        ...kontrakForm,
        nilai_kontrak: Number(kontrakForm.nilai_kontrak) || 0,
      });
      setFlash(r.message || 'Kontrak tersimpan');
      setFlashType('success');
      setShowKontrak(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSavingKontrak(false);
    }
  }

  async function onDelete(row: LaborKontrak) {
    if (!confirm(`Hapus kontrak ${row.no}? Semua data pekerja akan terhapus.`)) return;
    try {
      const r = await api.delete<{ message?: string }>(`/labor/delete/${row.id}`);
      setFlash(r.message || 'Kontrak dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedQ(searchQ);
    setAppliedStatus(filterStatus);
  }

  async function openPekerjaModal(row: LaborKontrak) {
    setPekerjaKontrakId(row.id);
    setPekerjaKontrakNo(row.no);
    resetPekerjaForm();
    try {
      const r = await api.get<{
        pekerja: LaborPekerja[];
        summary: PekerjaSummary;
      }>(`/labor/pekerja/${row.id}`);
      setPekerjaList(r.pekerja || []);
      setPekerjaSummary(r.summary || { manpower: 0, lembur: 0, tambahan: 0, total: 0 });
      setShowPekerja(true);
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal memuat pekerja');
      setFlashType('danger');
    }
  }

  function resetPekerjaForm() {
    setPekerjaForm({ ...EMPTY_PEKERJA, bulan: today().slice(0, 7) });
  }

  async function reloadPekerjaModal() {
    const r = await api.get<{ pekerja: LaborPekerja[]; summary: PekerjaSummary }>(
      `/labor/pekerja/${pekerjaKontrakId}`,
    );
    setPekerjaList(r.pekerja || []);
    setPekerjaSummary(r.summary || { manpower: 0, lembur: 0, tambahan: 0, total: 0 });
    load();
  }

  async function onSavePekerja(e: FormEvent) {
    e.preventDefault();
    if (!pekerjaForm.nama.trim()) {
      setFlash('Nama pekerja harus diisi');
      setFlashType('danger');
      return;
    }
    setSavingPekerja(true);
    try {
      const r = await api.post<{ message?: string }>('/labor/pekerja/save', {
        id: pekerjaForm.id || undefined,
        kontrak_id: pekerjaKontrakId,
        nama: pekerjaForm.nama,
        jabatan: pekerjaForm.jabatan,
        nik: pekerjaForm.nik,
        bulan: pekerjaForm.bulan,
        jumlah_orang: Number(pekerjaForm.jumlah_orang) || 1,
        biaya: Number(pekerjaForm.biaya) || 0,
        biaya_lembur: Number(pekerjaForm.biaya_lembur) || 0,
        biaya_tambahan: Number(pekerjaForm.biaya_tambahan) || 0,
      });
      setFlash(r.message || 'Pekerja disimpan');
      setFlashType('success');
      resetPekerjaForm();
      await reloadPekerjaModal();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSavingPekerja(false);
    }
  }

  const pekerjaTotalPreview = calcPekerjaTotal(pekerjaForm);

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
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.setorMassal_custom} size={24} style={{ marginRight: 8 }} />
            Labor Supply
          </h2>
          <p>
            {rows.length} kontrak · Total nilai: <b>Rp {fmtRp(totalKontrak)}</b> · Laba bersih:{' '}
            <b>Rp {fmtRp(totalLaba)}</b>
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <a
            href={api.exportUrl('/labor/export?fmt=xlsx')}
            className="btn btn-sm btn-outline-success"
            style={btnStyle}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-file-earmark-excel me-1" />
            Excel
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
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openAddKontrak}>
            <i className="bi bi-plus-lg me-1" />
            Tambah Kontrak
          </button>
        </div>
      </div>

      <form className="toolbar no-print d-flex gap-2 mb-3 flex-wrap" onSubmit={onSearch}>
        <select
          className="form-select form-select-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 130, borderRadius: 6 }}
        >
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="selesai">Selesai</option>
        </select>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Klien / Pekerjaan..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{ width: 200, borderRadius: 6 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={btnStyle}>
          <i className="bi bi-search me-1" />
          Cari
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          style={btnStyle}
          onClick={() => {
            setSearchQ('');
            setFilterStatus('');
            setAppliedQ('');
            setAppliedStatus('');
          }}
        >
          Reset
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted">Belum ada data kontrak labor.</p>
      ) : (
        <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th>No Kontrak</th>
                <th>Tgl</th>
                <th>Klien</th>
                <th>Pekerjaan</th>
                <th>Lokasi</th>
                <th>Periode</th>
                <th className="text-end">Nilai Kontrak</th>
                <th className="text-end">Biaya Pekerja</th>
                <th className="text-end">PPh 21</th>
                <th className="text-end">Laba Kotor</th>
                <th className="text-end">PPh 23</th>
                <th className="text-end">Laba Bersih</th>
                <th className="text-center">Pekerja</th>
                <th>Status</th>
                <th className="no-print">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <small className="mono">{row.no}</small>
                  </td>
                  <td style={{ fontSize: 11 }}>{row.tgl}</td>
                  <td className="fw-semibold">{row.klien}</td>
                  <td style={{ fontSize: 11 }}>{row.pekerjaan}</td>
                  <td style={{ fontSize: 11, color: '#64748B' }}>{row.lokasi}</td>
                  <td style={{ fontSize: 10, color: '#64748B' }}>
                    {row.tgl_mulai} s/d {row.tgl_selesai}
                  </td>
                  <td className="text-end mono">{fmtRp(row.nilai_kontrak)}</td>
                  <td className="text-end mono">{fmtRp(row.total_biaya || 0)}</td>
                  <td className="text-end mono" style={{ color: '#D97706' }}>
                    {fmtRp(row.pph21_total || 0)}
                  </td>
                  <td className="text-end mono">{fmtRp(row.laba_kotor || 0)}</td>
                  <td className="text-end mono" style={{ color: '#7C3AED' }}>
                    {fmtRp(row.pph23 || 0)}
                  </td>
                  <td
                    className="text-end mono fw-bold"
                    style={{ color: (row.laba_bersih || 0) > 0 ? '#16A34A' : '#DC2626' }}
                  >
                    {fmtRp(row.laba_bersih || 0)}
                  </td>
                  <td className="text-center">
                    <span className="bd bd-gray">{row.jml_pekerja || 0}</span>
                  </td>
                  <td>
                    <span className={`bd ${row.status === 'selesai' ? 'bd-green' : 'bd-amber'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="no-print">
                    <button
                      type="button"
                      className="btn btn-act btn-outline-info"
                      onClick={() => openPekerjaModal(row)}
                      title="Pekerja"
                    >
                      <i className="bi bi-people" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-act btn-outline-primary"
                      onClick={() => openEditKontrak(row)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-act btn-outline-danger"
                      onClick={() => onDelete(row)}
                      title="Hapus"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showKontrak}
        title={kontrakForm.id ? `Edit Kontrak: ${kontrakForm.no}` : 'Tambah Kontrak Labor'}
        size="lg"
        onClose={() => setShowKontrak(false)}
      >
        <form onSubmit={onSaveKontrak}>
          <div className="row g-2">
            <div className="col-md-8 mb-2">
              <label className="form-label">Klien / Perusahaan *</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={kontrakForm.klien}
                onChange={(e) => setKontrakForm({ ...kontrakForm, klien: e.target.value })}
                required
              />
            </div>
            <div className="col-md-4 mb-2">
              <label className="form-label">Tanggal</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={kontrakForm.tgl}
                onChange={(e) => setKontrakForm({ ...kontrakForm, tgl: e.target.value })}
              />
            </div>
            <div className="col-12 mb-2">
              <label className="form-label fl">Nama Pekerjaan</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={kontrakForm.pekerjaan}
                onChange={(e) => setKontrakForm({ ...kontrakForm, pekerjaan: e.target.value })}
                placeholder="mis: Pengiriman tenaga kerja proyek X"
              />
            </div>
            <div className="col-md-6 mb-2">
              <label className="form-label">Lokasi</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={kontrakForm.lokasi}
                onChange={(e) => setKontrakForm({ ...kontrakForm, lokasi: e.target.value })}
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Tgl Mulai</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={kontrakForm.tgl_mulai}
                onChange={(e) => setKontrakForm({ ...kontrakForm, tgl_mulai: e.target.value })}
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Tgl Selesai</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={kontrakForm.tgl_selesai}
                onChange={(e) => setKontrakForm({ ...kontrakForm, tgl_selesai: e.target.value })}
              />
            </div>
            <div className="col-md-5 mb-2">
              <label className="form-label">Nilai Kontrak (Rp) *</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={kontrakForm.nilai_kontrak}
                onChange={(e) => setKontrakForm({ ...kontrakForm, nilai_kontrak: e.target.value })}
                min="0"
                required
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Status</label>
              <select
                className="form-select form-select-sm"
                value={kontrakForm.status}
                onChange={(e) => setKontrakForm({ ...kontrakForm, status: e.target.value })}
              >
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
            <div className="col-12 mb-2">
              <label className="form-label">Catatan</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={kontrakForm.catatan}
                onChange={(e) => setKontrakForm({ ...kontrakForm, catatan: e.target.value })}
              />
            </div>
          </div>
          <ModalFooter onCancel={() => setShowKontrak(false)} saving={savingKontrak} />
        </form>
      </Modal>

      <Modal
        open={showPekerja}
        title={`Pekerja Kontrak: ${pekerjaKontrakNo}`}
        size="lg"
        onClose={() => setShowPekerja(false)}
      >
        {pekerjaList.length > 0 && (
          <div
            className="d-flex gap-3 mb-2 flex-wrap"
            style={{ fontSize: 11, background: '#F8FAFC', padding: '6px 10px', borderRadius: 6 }}
          >
            <span>
              Manpower: <b>Rp {fmtRp(pekerjaSummary.manpower)}</b>
            </span>
            <span>
              Overtime: <b>Rp {fmtRp(pekerjaSummary.lembur)}</b>
            </span>
            <span>
              Tambahan: <b>Rp {fmtRp(pekerjaSummary.tambahan)}</b>
            </span>
            <span style={{ color: '#0F2744', fontWeight: 700 }}>
              Total: <b>Rp {fmtRp(pekerjaSummary.total)}</b>
            </span>
          </div>
        )}

        {pekerjaList.length === 0 ? (
          <p className="text-muted text-center py-2">Belum ada pekerja</p>
        ) : (
          <div className="tbl-wrap mb-3" style={{ maxHeight: 220, overflow: 'auto' }}>
            <table className="table table-sm" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th>Nama/Kel.</th>
                  <th className="text-center">Jml</th>
                  <th className="text-end">Manpower/org</th>
                  <th className="text-end">Overtime/org</th>
                  <th className="text-end">Tambahan/org</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">PPh21</th>
                  <th className="text-end">Net</th>
                </tr>
              </thead>
              <tbody>
                {pekerjaList.map((p) => {
                  const tot =
                    p.total_biaya ||
                    (p.biaya + p.biaya_lembur + p.biaya_tambahan) * (p.jumlah_orang || 1);
                  return (
                    <tr key={p.id}>
                      <td className="mono" style={{ fontSize: 10 }}>
                        {p.bulan || '-'}
                      </td>
                      <td className="fw-semibold">{p.nama}</td>
                      <td className="text-center">{p.jumlah_orang || 1}</td>
                      <td className="text-end mono">{fmtRp(p.biaya)}</td>
                      <td className="text-end mono">{fmtRp(p.biaya_lembur || 0)}</td>
                      <td className="text-end mono">{fmtRp(p.biaya_tambahan || 0)}</td>
                      <td className="text-end mono fw-bold">{fmtRp(tot)}</td>
                      <td className="text-end mono text-warning">{fmtRp(p.pph21)}</td>
                      <td className="text-end mono fw-bold text-success">{fmtRp(tot - p.pph21)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <hr />
        <h6 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          {pekerjaForm.id ? 'Edit Pekerja' : 'Tambah Pekerja'}
        </h6>
        <form onSubmit={onSavePekerja}>
          <div className="row g-2">
            <div className="col-md-4 mb-2">
              <label className="form-label">Nama / Kelompok *</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={pekerjaForm.nama}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, nama: e.target.value })}
                required
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Jabatan / Kategori</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={pekerjaForm.jabatan}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, jabatan: e.target.value })}
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">NIK / No. ID</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={pekerjaForm.nik}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, nik: e.target.value })}
              />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Bulan</label>
              <input
                type="month"
                className="form-control form-control-sm"
                value={pekerjaForm.bulan}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, bulan: e.target.value })}
              />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Jumlah Orang</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={pekerjaForm.jumlah_orang}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, jumlah_orang: e.target.value })}
                min="1"
              />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Biaya Manpower (Rp/org)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={pekerjaForm.biaya}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, biaya: e.target.value })}
                min="0"
              />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Biaya Overtime (Rp/org)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={pekerjaForm.biaya_lembur}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, biaya_lembur: e.target.value })}
                min="0"
              />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Biaya Tambahan (Rp/org)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={pekerjaForm.biaya_tambahan}
                onChange={(e) => setPekerjaForm({ ...pekerjaForm, biaya_tambahan: e.target.value })}
                min="0"
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Total Biaya (Auto)</label>
              <div
                className="p-2 rounded fw-bold"
                style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: 14, minHeight: 32 }}
              >
                Rp {fmtRp(pekerjaTotalPreview)}
              </div>
            </div>
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-sm btn-navy" disabled={savingPekerja}>
              <i className="bi bi-save me-1" />
              {savingPekerja ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary ms-1" onClick={resetPekerjaForm}>
              Reset
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

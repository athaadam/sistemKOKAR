'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ImportModalBody, ModalFooter } from '@/components/crud/ListPageChrome';

type PinjamanRow = {
  id: string;
  no: string;
  anggota_id: string;
  anggota_nama: string;
  nip?: string;
  anggota_no?: string;
  jenis: string;
  nominal: number;
  tenor: number;
  bunga: number;
  angsuran: number;
  sisa_pokok: number;
  status: string;
  tgl_pengajuan?: string;
  tgl_cair?: string;
  rate_type?: string;
};

type AnggotaOpt = {
  id: string;
  no: string;
  nama: string;
  limit_pinjaman?: number;
  limit_darurat?: number;
  max_loans?: number;
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

const METODE_OPTS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'potong-gaji', label: 'Potong Gaji' },
];

function calcAngsuranEst(
  nominal: number,
  tenor: number,
  jenis: string,
  rateType: string,
  bungaReg: number,
  bungaDar: number,
): number {
  if (nominal <= 0 || tenor <= 0) return 0;
  const bunga = jenis === 'darurat' ? bungaDar : bungaReg;
  if (rateType === 'sliding') return Math.round(nominal / tenor + (nominal * bunga) / 100);
  return Math.round((nominal * (1 + (bunga / 100) * tenor)) / tenor);
}

export function PinjamanPageContent() {
  const [rows, setRows] = useState<PinjamanRow[]>([]);
  const [anggotaList, setAnggotaList] = useState<AnggotaOpt[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalAngsuranBln, setTotalAngsuranBln] = useState(0);
  const [bungaReg, setBungaReg] = useState(1.5);
  const [bungaDar, setBungaDar] = useState(2);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showAjukan, setShowAjukan] = useState(false);
  const [ajukan, setAjukan] = useState({
    anggota_id: '',
    jenis: 'regular',
    nominal: '',
    tenor: '12',
    rate_type: 'flat',
    tgl_pengajuan: today(),
    tgl_cair: today(),
  });
  const [pinInfo, setPinInfo] = useState('');
  const [saving, setSaving] = useState(false);

  const [showBayar, setShowBayar] = useState(false);
  const [bayarPin, setBayarPin] = useState<PinjamanRow | null>(null);
  const [bayarForm, setBayarForm] = useState({ tgl: today(), metode: 'tunai' });

  const [showTopup, setShowTopup] = useState(false);
  const [topupId, setTopupId] = useState('');
  const [topupForm, setTopupForm] = useState({ tambahan: '', tenor_baru: '12', keterangan: '' });

  const [showRestruktur, setShowRestruktur] = useState(false);
  const [restrukturId, setRestrukturId] = useState('');
  const [restrukturForm, setRestrukturForm] = useState({ tenor_baru: '12', bunga_baru: '', keterangan: '' });

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const pinAktif = useMemo(() => rows.filter((r) => r.status === 'aktif').length, [rows]);

  const limitValidation = useMemo(() => {
    if (!ajukan.anggota_id) return { valid: true, message: '' };

    const anggota = anggotaList.find((x) => x.id === ajukan.anggota_id);
    if (!anggota) return { valid: true, message: '' };

    const nominal = Number(ajukan.nominal) || 0;
    if (nominal <= 0) return { valid: true, message: '' };

    if (ajukan.jenis === 'regular') {
      // Regular loans: check both limit_pinjaman and max_loans
      const maxLoans = anggota.max_loans ?? 5;
      const pinjamanAktifReg = rows.filter((r) => r.anggota_id === ajukan.anggota_id && r.status === 'aktif' && r.jenis === 'regular').length;
      const sisaPinjaman = Math.max(0, maxLoans - pinjamanAktifReg);

      const limitKredit = anggota.limit_pinjaman ?? 0;
      const pinjamanAktifTotal = rows.filter((r) => r.anggota_id === ajukan.anggota_id && r.status === 'aktif').reduce((sum, r) => sum + r.nominal, 0);
      const sisaLimit = Math.max(0, limitKredit - pinjamanAktifTotal);

      if (sisaPinjaman <= 0) {
        return { valid: false, message: '❌ Sudah mencapai batas maksimal pinjaman reguler' };
      }
      if (nominal > sisaLimit) {
        return { valid: false, message: `❌ Nominal melebihi sisa limit kredit (Sisa: Rp ${fmtRp(sisaLimit)})` };
      }
      return { valid: true, message: `✓ Sisa pinjaman: ${sisaPinjaman - 1}/${maxLoans} | Sisa limit: Rp ${fmtRp(sisaLimit - nominal)}` };
    } else {
      // Emergency loans: not affected by limit_pinjaman or max_loans
      return { valid: true, message: '✓ Pinjaman darurat tidak dibatasi oleh limit reguler' };
    }
  }, [ajukan.anggota_id, ajukan.jenis, ajukan.nominal, anggotaList, rows]);

  const angsuranEst = useMemo(
    () =>
      calcAngsuranEst(
        Number(ajukan.nominal) || 0,
        Number(ajukan.tenor) || 12,
        ajukan.jenis,
        ajukan.rate_type,
        bungaReg,
        bungaDar,
      ),
    [ajukan, bungaReg, bungaDar],
  );

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filterStatus) qs.set('status', filterStatus);
    if (filterQ) qs.set('q', filterQ);
    const query = qs.toString() ? `?${qs}` : '';
    api
      .get<{
        rows: PinjamanRow[];
        anggota_list: AnggotaOpt[];
        total_outstanding: number;
        total_angsuran_bln: number;
        bunga_reg: number;
        bunga_dar: number;
      }>(`/pinjaman${query}`)
      .then((r) => {
        setRows(r.rows || []);
        setAnggotaList(r.anggota_list || []);
        setTotalOutstanding(Number(r.total_outstanding) || 0);
        setTotalAngsuranBln(Number(r.total_angsuran_bln) || 0);
        setBungaReg(Number(r.bunga_reg) || 1.5);
        setBungaDar(Number(r.bunga_dar) || 2);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus, filterQ]);

  useEffect(() => {
    load();
  }, [load]);

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setFilterStatus(statusFilter);
    setFilterQ(q);
  }

  function resetSearch() {
    setQ('');
    setStatusFilter('');
    setFilterStatus('');
    setFilterQ('');
  }

  function onAnggotaChange(aid: string) {
    const a = anggotaList.find((x) => x.id === aid);
    if (a) {
      const maxLoans = a.max_loans ?? 5;
      const pinjamanAktifReg = rows.filter((r) => r.anggota_id === aid && r.status === 'aktif' && r.jenis === 'regular').length;
      const sisaPinjaman = Math.max(0, maxLoans - pinjamanAktifReg);
      const limitKredit = a.limit_pinjaman ?? 0;
      const pinjamanAktifTotal = rows.filter((r) => r.anggota_id === aid && r.status === 'aktif').reduce((sum, r) => sum + r.nominal, 0);
      const sisaLimit = Math.max(0, limitKredit - pinjamanAktifTotal);

      setPinInfo(
        `Regular - Limit Kredit: Rp ${fmtRp(limitKredit)} (Sisa: Rp ${fmtRp(sisaLimit)}) | Sisa Max Pinjaman: ${sisaPinjaman}/${maxLoans} | Emergency - Limit: Rp ${fmtRp(a.limit_darurat)}`,
      );
    } else {
      setPinInfo('');
    }
    setAjukan((prev) => ({ ...prev, anggota_id: aid }));
  }

  async function onAjukan(e: FormEvent) {
    e.preventDefault();
    if (!ajukan.anggota_id || !ajukan.nominal) return;

    // Validate limits
    if (!limitValidation.valid) {
      setFlash(limitValidation.message);
      setFlashType('danger');
      return;
    }

    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/pinjaman/ajukan', {
        anggota_id: ajukan.anggota_id,
        jenis: ajukan.jenis,
        nominal: Number(ajukan.nominal),
        tenor: Number(ajukan.tenor),
        rate_type: ajukan.rate_type,
        tgl_pengajuan: ajukan.tgl_pengajuan,
        tgl_cair: ajukan.tgl_cair,
      });
      setFlash(r.message || 'Pinjaman berhasil diajukan');
      setFlashType('success');
      setShowAjukan(false);
      setAjukan({
        anggota_id: '',
        jenis: 'regular',
        nominal: '',
        tenor: '12',
        rate_type: 'flat',
        tgl_pengajuan: today(),
        tgl_cair: today(),
      });
      setPinInfo('');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal mengajukan');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  function openBayar(row: PinjamanRow) {
    setBayarPin(row);
    setBayarForm({ tgl: today(), metode: 'tunai' });
    setShowBayar(true);
  }

  async function onBayar(e: FormEvent) {
    e.preventDefault();
    if (!bayarPin) return;
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>(`/pinjaman/bayar/${bayarPin.id}`, bayarForm);
      setFlash(r.message || 'Angsuran berhasil');
      setFlashType('success');
      setShowBayar(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal bayar angsuran');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function lunasPin(row: PinjamanRow) {
    if (!confirm('Lunasi pinjaman ini sekarang?')) return;
    try {
      const r = await api.get<{ message?: string }>(`/pinjaman/lunas/${row.id}`);
      setFlash(r.message || 'Pinjaman dilunasi');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal pelunasan');
      setFlashType('danger');
    }
  }

  async function deletePin(row: PinjamanRow) {
    if (!confirm('Hapus pinjaman?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/pinjaman/delete/${row.id}`);
      setFlash(r.message || 'Pinjaman dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  function openTopup(id: string) {
    setTopupId(id);
    setTopupForm({ tambahan: '', tenor_baru: '12', keterangan: '' });
    setShowTopup(true);
  }

  async function onTopup(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>(`/pinjaman/topup/${topupId}`, {
        tambahan: Number(topupForm.tambahan),
        tenor_baru: Number(topupForm.tenor_baru),
        keterangan: topupForm.keterangan,
      });
      setFlash(r.message || 'Top-up berhasil');
      setFlashType('success');
      setShowTopup(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal top-up');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  function openRestruktur(id: string) {
    setRestrukturId(id);
    setRestrukturForm({ tenor_baru: '12', bunga_baru: '', keterangan: '' });
    setShowRestruktur(true);
  }

  async function onRestruktur(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>(`/pinjaman/restrukturisasi/${restrukturId}`, {
        tenor_baru: Number(restrukturForm.tenor_baru),
        bunga_baru: restrukturForm.bunga_baru ? Number(restrukturForm.bunga_baru) : undefined,
        keterangan: restrukturForm.keterangan,
      });
      setFlash(r.message || 'Restrukturisasi berhasil');
      setFlashType('success');
      setShowRestruktur(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal restrukturisasi');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const r = await api.postForm<{ message?: string }>('/pinjaman/import', fd);
      setFlash(r.message || 'Import selesai');
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

  if (loading && !rows.length) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <>
      <Flash message={flash} type={flashType} onClose={() => setFlash('')} />
      {err && <Flash message={err} type="danger" />}

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>Pinjaman Anggota</h2>
          <p>
            Bunga Regular <b>{bungaReg}%</b>/bln · Darurat <b>{bungaDar}%</b>/bln · {rows.length} pinjaman
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl('/pinjaman/export?fmt=xlsx')} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">
            Excel
          </a>
          <a href={api.exportUrl('/pinjaman/export?fmt=csv')} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">
            CSV
          </a>
          <button type="button" className="btn btn-sm btn-outline-warning" style={btnStyle} onClick={() => setShowImport(true)}>
            Import
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
            Print
          </button>
          <Link href="/pinjaman/kolektif" className="btn btn-sm btn-outline-info" style={btnStyle}>
            Kolektif
          </Link>
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={() => setShowAjukan(true)}>
            Ajukan Pinjaman
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3 no-print">
        <div className="col-md-4">
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-val">Rp {fmtRp(totalOutstanding)}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Total Outstanding Pinjaman</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-val">Rp {fmtRp(totalAngsuranBln)}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Total Angsuran / Bulan</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-val">{pinAktif}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Pinjaman Aktif</div>
          </div>
        </div>
      </div>

      <form className="toolbar no-print" onSubmit={applySearch}>
        <select
          className="form-select form-select-sm"
          style={{ width: 130, borderRadius: 6 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="lunas">Lunas</option>
          <option value="macet">Macet</option>
        </select>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / no..."
          className="form-control form-control-sm"
          style={{ width: 200, borderRadius: 6 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={btnStyle}>
          Cari
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" style={btnStyle} onClick={resetSearch}>
          Reset
        </button>
      </form>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>No Pinjaman</th>
              <th>Anggota</th>
              <th>Jenis</th>
              <th>Tgl Cair</th>
              <th className="text-end">Nominal</th>
              <th className="text-end">Bunga</th>
              <th className="text-end">Angsuran/bln</th>
              <th className="text-end">Sisa Pokok</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted py-4">
                  Belum ada data pinjaman
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={r.status === 'macet' ? 'table-warning' : ''}>
                  <td>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {r.no}
                    </span>
                  </td>
                  <td className="fw-semibold">
                    {r.anggota_nama}
                    <br />
                    <span className="text-muted mono" style={{ fontSize: 10 }}>
                      {r.nip}
                    </span>
                  </td>
                  <td>
                    <span className={`bd ${r.jenis === 'darurat' ? 'bd-amber' : 'bd-navy'}`}>{r.jenis}</span>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.tgl_cair || '—'}</td>
                  <td className="text-end mono">Rp {fmtRp(r.nominal)}</td>
                  <td className="text-end mono">
                    {r.bunga}%
                    <br />
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      {r.rate_type || 'flat'}
                    </span>
                  </td>
                  <td className="text-end mono fw-semibold">Rp {fmtRp(r.angsuran)}</td>
                  <td
                    className={`text-end mono ${r.sisa_pokok > 0 ? 'text-danger fw-bold' : 'text-success'}`}
                  >
                    Rp {fmtRp(r.sisa_pokok)}
                  </td>
                  <td>
                    <span
                      className={`bd ${
                        r.status === 'lunas' ? 'bd-green' : r.status === 'aktif' ? 'bd-amber' : 'bd-red'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="no-print text-nowrap">
                    {r.status === 'aktif' && (
                      <>
                        <button type="button" className="btn btn-act btn-navy me-1" onClick={() => openBayar(r)}>
                          Angsur
                        </button>
                        <button type="button" className="btn btn-act btn-outline-success me-1" onClick={() => lunasPin(r)}>
                          Lunas
                        </button>
                        <Link
                          href={`/pinjaman/slip/${r.id}`}
                          target="_blank"
                          className="btn btn-act btn-outline-info me-1"
                        >
                          Slip
                        </Link>
                        <button type="button" className="btn btn-act btn-outline-warning me-1" onClick={() => openTopup(r.id)}>
                          Top-up
                        </button>
                        <button
                          type="button"
                          className="btn btn-act btn-outline-secondary me-1"
                          onClick={() => openRestruktur(r.id)}
                        >
                          Restruktur
                        </button>
                      </>
                    )}
                    <button type="button" className="btn btn-act btn-outline-danger" onClick={() => deletePin(r)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showAjukan} onClose={() => setShowAjukan(false)} title="Pengajuan Pinjaman" size="lg">
        <form onSubmit={onAjukan}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-12">
                <label className="fl">Anggota *</label>
                <select
                  className="form-select form-select-sm"
                  value={ajukan.anggota_id}
                  onChange={(e) => onAnggotaChange(e.target.value)}
                  required
                >
                  <option value="">— Pilih Anggota —</option>
                  {anggotaList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.no} — {a.nama}
                    </option>
                  ))}
                </select>
              </div>
              {pinInfo && (
                <div className="col-12">
                  <div className="p-3 rounded" style={{ background: '#EFF6FF', border: '2px solid #3B82F6', fontSize: 12, color: '#1D4ED8', fontWeight: 500 }}>
                    ℹ️ {pinInfo}
                  </div>
                </div>
              )}
              <div className="col-md-6">
                <label className="fl">Jenis Pinjaman</label>
                <select
                  className="form-select form-select-sm"
                  value={ajukan.jenis}
                  onChange={(e) => setAjukan({ ...ajukan, jenis: e.target.value })}
                >
                  <option value="regular">Regular (Bunga {bungaReg}%/bln)</option>
                  <option value="darurat">Darurat (Bunga {bungaDar}%/bln)</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Nominal (Rp) *</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={ajukan.nominal}
                  onChange={(e) => setAjukan({ ...ajukan, nominal: e.target.value })}
                  required
                  min={1}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Tenor (bulan) *</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={ajukan.tenor}
                  onChange={(e) => setAjukan({ ...ajukan, tenor: e.target.value })}
                  required
                  min={1}
                  max={60}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Tipe Bunga</label>
                <select
                  className="form-select form-select-sm"
                  value={ajukan.rate_type}
                  onChange={(e) => setAjukan({ ...ajukan, rate_type: e.target.value })}
                >
                  <option value="flat">Flat</option>
                  <option value="sliding">Menurun / Sliding Rate</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="fl">Tgl Pengajuan</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={ajukan.tgl_pengajuan}
                  onChange={(e) => setAjukan({ ...ajukan, tgl_pengajuan: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Tgl Cair</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={ajukan.tgl_cair}
                  onChange={(e) => setAjukan({ ...ajukan, tgl_cair: e.target.value })}
                />
              </div>
              <div className="col-12">
                <div className="p-2 rounded" style={{ background: '#F0FDF4', border: '1px solid #86EFAC', fontSize: 12 }}>
                  Estimasi Angsuran/bln:{' '}
                  <b style={{ color: '#16A34A', fontSize: 14 }}>
                    {angsuranEst > 0
                      ? `Rp ${fmtRp(angsuranEst)} (bunga ${ajukan.jenis === 'darurat' ? bungaDar : bungaReg}%/bln, ${ajukan.rate_type})`
                      : '—'}
                  </b>
                </div>
              </div>
              <div className="col-12">
                <div style={{ fontSize: 12, background: limitValidation.valid ? '#F0FDF4' : '#FEE2E2', border: `1px solid ${limitValidation.valid ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 6, padding: '8px 12px', color: limitValidation.valid ? '#16A34A' : '#DC2626' }}>
                  {limitValidation.message}
                </div>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowAjukan(false)} saving={saving} submitLabel="Proses Pengajuan" disabled={!limitValidation.valid && Number(ajukan.nominal) > 0} />
        </form>
      </Modal>

      <Modal open={showBayar} onClose={() => setShowBayar(false)} title="Bayar Angsuran" size="md">
        <form onSubmit={onBayar}>
          <div className="modal-body">
            <div className="p-2 rounded mb-2" style={{ background: '#EFF6FF', fontSize: 12 }}>
              <b>{bayarPin?.no}</b>
            </div>
            <div className="mb-2" style={{ fontSize: 13 }}>
              Jumlah angsuran: <b className="text-success">Rp {fmtRp(bayarPin?.angsuran)}</b>
            </div>
            <div className="row g-2">
              <div className="col-md-6">
                <label className="fl">Tanggal</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={bayarForm.tgl}
                  onChange={(e) => setBayarForm({ ...bayarForm, tgl: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Metode</label>
                <select
                  className="form-select form-select-sm"
                  value={bayarForm.metode}
                  onChange={(e) => setBayarForm({ ...bayarForm, metode: e.target.value })}
                >
                  {METODE_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowBayar(false)} saving={saving} submitLabel="Konfirmasi Bayar" />
        </form>
      </Modal>

      <Modal open={showTopup} onClose={() => setShowTopup(false)} title="Top-up Pinjaman" size="md">
        <form onSubmit={onTopup}>
          <div className="modal-body">
            <label className="fl">Tambahan Pinjaman</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={topupForm.tambahan}
              onChange={(e) => setTopupForm({ ...topupForm, tambahan: e.target.value })}
              required
              min={1}
            />
            <label className="fl mt-2">Tenor Baru</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={topupForm.tenor_baru}
              onChange={(e) => setTopupForm({ ...topupForm, tenor_baru: e.target.value })}
            />
            <label className="fl mt-2">Keterangan</label>
            <textarea
              className="form-control form-control-sm"
              value={topupForm.keterangan}
              onChange={(e) => setTopupForm({ ...topupForm, keterangan: e.target.value })}
            />
          </div>
          <ModalFooter onCancel={() => setShowTopup(false)} saving={saving} submitLabel="Simpan Top-up" />
        </form>
      </Modal>

      <Modal open={showRestruktur} onClose={() => setShowRestruktur(false)} title="Restrukturisasi Pinjaman" size="md">
        <form onSubmit={onRestruktur}>
          <div className="modal-body">
            <label className="fl">Tenor Baru</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={restrukturForm.tenor_baru}
              onChange={(e) => setRestrukturForm({ ...restrukturForm, tenor_baru: e.target.value })}
            />
            <label className="fl mt-2">Bunga Baru (%)</label>
            <input
              type="number"
              step={0.01}
              className="form-control form-control-sm"
              value={restrukturForm.bunga_baru}
              onChange={(e) => setRestrukturForm({ ...restrukturForm, bunga_baru: e.target.value })}
            />
            <label className="fl mt-2">Keterangan</label>
            <textarea
              className="form-control form-control-sm"
              value={restrukturForm.keterangan}
              onChange={(e) => setRestrukturForm({ ...restrukturForm, keterangan: e.target.value })}
            />
          </div>
          <ModalFooter onCancel={() => setShowRestruktur(false)} saving={saving} submitLabel="Simpan Restrukturisasi" />
        </form>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Pinjaman (CSV)" size="md">
        <form onSubmit={onImport}>
          <div className="modal-body">
            <ImportModalBody
              columns="nip, jenis, nominal, tenor, bunga, angsuran, sisa_pokok, status, tgl_pengajuan, tgl_cair"
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

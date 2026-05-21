'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP, type IconConfig } from '@/components/ui/IconRenderer';
import { PembukuanSubNav } from './PembukuanSubNav';

type TabId = 'jurnal' | 'neraca' | 'laba_rugi' | 'shu';

type JurnalRow = {
  id: string;
  no: string;
  tgl: string;
  modul: string;
  ket: string;
  debit: string;
  kredit: string;
  nominal: number;
};

type CoaOpt = { nama: string; kode?: string };

type Neraca = Record<string, number>;
type LabaRugi = Record<string, number>;

type ShuAlokasi = { code: string; label: string; key: string; pct: number; jumlah: number };
type ShuKontribusi = {
  no?: string;
  nama: string;
  modal: number;
  pinjaman: number;
  konsumsi: number;
  shu_modal: number;
  shu_pinjaman: number;
  shu_konsumsi: number;
  shu_total: number;
};

type ShuData = {
  bruto: number;
  alokasi: ShuAlokasi[];
  check: number;
  total_pct: number;
  kontribusi?: ShuKontribusi[];
  [key: string]: unknown;
};

const MODUL_OPTS = ['Kas', 'Bank', 'Simpan Pinjam', 'Toko', 'Operasional', 'Labor', 'Rental', 'PPOB', 'Umum'];

const TABS: { id: TabId; label: string; icon: IconConfig }[] = [
  { id: 'jurnal', label: 'Jurnal Umum', icon: ICON_MAP.pembukuan_custom },
  { id: 'neraca', label: 'Neraca', icon: ICON_MAP.neraca_custom },
  { id: 'laba_rugi', label: 'Laba Rugi', icon: ICON_MAP.labaRugi_custom },
  { id: 'shu', label: 'SHU', icon: ICON_MAP.shu_custom },
];

const SHU_FORM = [
  { key: 'shu_cadangan_pct', label: 'Dana Cadangan', def: 8 },
  { key: 'shu_simpanan_anggota_pct', label: 'Dana Simpanan Anggota', def: 25 },
  { key: 'shu_bunga_pinjaman_pct', label: 'Kontribusi Bunga Pinjaman', def: 20 },
  { key: 'shu_konsumsi_pct', label: 'Kontribusi Konsumsi', def: 15 },
  { key: 'shu_parcel_pct', label: 'Dana Parcel', def: 15 },
  { key: 'shu_pengurus_pct', label: 'Dana Pengurus', def: 12 },
  { key: 'shu_kesejahteraan_pct', label: 'Dana Kesejahteraan', def: 1 },
  { key: 'shu_pendidikan_pct', label: 'Dana Pendidikan', def: 1 },
  { key: 'shu_pembangunan_pct', label: 'Pembangunan Daerah Kerja', def: 1 },
  { key: 'shu_sosial_pct', label: 'Dana Sosial', def: 2 },
];

const btnStyle = { borderRadius: 6, fontSize: 12 };
const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

function Rp({ n }: { n: number }) {
  return <span className="mono">{fmtRp(n)}</span>;
}

export function PembukuanPageContent() {
  const [tab, setTab] = useState<TabId>('jurnal');
  const [tahun, setTahun] = useState(today().slice(0, 4));
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [q, setQ] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterQ, setFilterQ] = useState('');

  const [jurnalRows, setJurnalRows] = useState<JurnalRow[]>([]);
  const [coaList, setCoaList] = useState<CoaOpt[]>([]);
  const [neraca, setNeraca] = useState<Neraca>({});
  const [labaRugi, setLabaRugi] = useState<LabaRugi>({});
  const [shu, setShu] = useState<ShuData>({ bruto: 0, alokasi: [], check: 0, total_pct: 0 });
  const [totalKas, setTotalKas] = useState(0);
  const [totalPiutang, setTotalPiutang] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [showJurnal, setShowJurnal] = useState(false);
  const [jurnalTitle, setJurnalTitle] = useState('Tambah Jurnal');
  const [jurnalForm, setJurnalForm] = useState({
    id: '',
    tgl: today(),
    modul: 'Umum',
    ket: '',
    debit: '',
    kredit: '',
    nominal: '',
  });
  const [saving, setSaving] = useState(false);
  const [shuPct, setShuPct] = useState<Record<string, string>>({});

  const jurnalMap = useMemo(() => {
    const m: Record<string, JurnalRow> = {};
    jurnalRows.forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [jurnalRows]);

  const shuTotalPct = useMemo(
    () => SHU_FORM.reduce((s, f) => s + (Number(shuPct[f.key]) || 0), 0),
    [shuPct],
  );

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams({ tab });
    if (tab === 'jurnal') {
      if (filterFrom) params.set('tgl_from', filterFrom);
      if (filterTo) params.set('tgl_to', filterTo);
      if (filterQ) params.set('q', filterQ);
    } else {
      params.set('tahun', tahun);
    }
    api
      .get<{
        jurnal_rows: JurnalRow[];
        coa_list: CoaOpt[];
        neraca: Neraca;
        laba_rugi: LabaRugi;
        shu: ShuData;
        total_kas: number;
        total_piutang: number;
      }>(`/pembukuan?${params}`)
      .then((r) => {
        setJurnalRows(r.jurnal_rows || []);
        setCoaList(r.coa_list || []);
        setNeraca(r.neraca || {});
        setLabaRugi(r.laba_rugi || {});
        setShu(r.shu || { bruto: 0, alokasi: [], check: 0, total_pct: 0 });
        setTotalKas(Number(r.total_kas) || 0);
        setTotalPiutang(Number(r.total_piutang) || 0);
        const pct: Record<string, string> = {};
        for (const f of SHU_FORM) {
          const item = (r.shu?.alokasi || []).find((a) => a.key === f.key);
          pct[f.key] = String(item?.pct ?? f.def);
        }
        setShuPct(pct);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tab, tahun, filterFrom, filterTo, filterQ]);

  useEffect(() => {
    load();
  }, [load]);

  function resetJurnal() {
    setJurnalForm({ id: '', tgl: today(), modul: 'Umum', ket: '', debit: '', kredit: '', nominal: '' });
    setJurnalTitle('Tambah Jurnal');
  }

  function editJurnal(row: JurnalRow) {
    setJurnalForm({
      id: row.id,
      tgl: row.tgl,
      modul: row.modul || 'Umum',
      ket: row.ket || '',
      debit: row.debit || '',
      kredit: row.kredit || '',
      nominal: String(row.nominal || 0),
    });
    setJurnalTitle('Edit Jurnal');
    setShowJurnal(true);
  }

  async function onJurnalSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/pembukuan/jurnal/save', {
        ...jurnalForm,
        nominal: Number(jurnalForm.nominal) || 0,
      });
      setFlash(r.message || 'Jurnal tersimpan');
      setFlashType('success');
      setShowJurnal(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function onJurnalDelete(id: string) {
    if (!confirm('Hapus jurnal?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/pembukuan/jurnal/delete/${id}`);
      setFlash(r.message || 'Jurnal dihapus');
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
      const r = await api.postForm<{ message?: string }>('/pembukuan/import/jurnal', fd);
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

  async function onShuSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      for (const f of SHU_FORM) body[f.key] = shuPct[f.key] || '0';
      const r = await api.post<{ message?: string }>('/pembukuan/shu/save', body);
      setFlash(r.message || 'Pengaturan SHU disimpan');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !jurnalRows.length && tab === 'jurnal' && !err) {
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
            <IconRenderer icon={ICON_MAP.pembukuan_custom} size={24} style={{ marginRight: 8 }} />
            Pembukuan Koperasi
          </h2>
          <p>Jurnal · Neraca · Laba Rugi · SHU</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl('/pembukuan/export/jurnal?fmt=xlsx')} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">
            Excel Jurnal
          </a>
          <button type="button" className="btn btn-sm btn-outline-warning" style={btnStyle} onClick={() => setShowImport((v) => !v)}>
            Import Jurnal
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: 12, marginBottom: 12 }} className="no-print">
          <form onSubmit={onImport} className="d-flex flex-wrap align-items-center gap-2">
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>Import Jurnal dari Excel:</span>
            <input type="file" accept=".xlsx,.xls" className="form-control form-control-sm" style={{ width: 240, borderRadius: 6 }} required onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            <button type="submit" className="btn btn-sm btn-navy" disabled={importing}>
              {importing ? 'Mengupload...' : 'Upload & Import'}
            </button>
            <span style={{ fontSize: 11, color: '#64748B' }}>Kolom: No, Tgl, Modul, Ref, Keterangan, Debit, Kredit, Nominal</span>
          </form>
        </div>
      )}

      <PembukuanSubNav tahun={tahun} />

      <ul className="nav nav-tabs mb-3 no-print" style={{ borderBottom: '2px solid #E2E8F0' }}>
        {TABS.map((t) => (
          <li className="nav-item" key={t.id}>
            <button
              type="button"
              className={`nav-link ${tab === t.id ? 'active fw-semibold' : ''}`}
              style={{ fontSize: 13, borderRadius: '6px 6px 0 0' }}
              onClick={() => setTab(t.id)}
            >
              <span className="d-inline-flex align-items-center gap-1">
                <IconRenderer icon={t.icon} size={16} />
                {t.label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {tab !== 'jurnal' && (
        <form
          className="toolbar no-print mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Tahun:</label>
          <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="form-select form-select-sm" style={{ width: 110, borderRadius: 6 }}>
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>
            Tampilkan
          </button>
          {tab === 'neraca' && (
            <a href={api.exportUrl(`/pembukuan/export/neraca?tahun=${tahun}`)} className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer">
              Export Neraca
            </a>
          )}
          {tab === 'laba_rugi' && (
            <a href={api.exportUrl(`/pembukuan/export/laba_rugi?tahun=${tahun}`)} className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer">
              Export Laba Rugi
            </a>
          )}
          {tab === 'shu' && (
            <a href={api.exportUrl(`/pembukuan/export/shu?tahun=${tahun}`)} className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer">
              Export SHU
            </a>
          )}
        </form>
      )}

      {tab === 'jurnal' && (
        <>
          <form
            className="toolbar no-print mb-2"
            onSubmit={(e) => {
              e.preventDefault();
              setFilterFrom(tglFrom);
              setFilterTo(tglTo);
              setFilterQ(q);
            }}
          >
            <input type="date" value={tglFrom} onChange={(e) => setTglFrom(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
            <span style={{ fontSize: 12, color: '#94A3B8' }}>s/d</span>
            <input type="date" value={tglTo} onChange={(e) => setTglTo(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keterangan / No / Modul..." className="form-control form-control-sm" style={{ width: 200, borderRadius: 6 }} />
            <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>
              Filter
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              style={{ borderRadius: 6 }}
              onClick={() => {
                setTglFrom('');
                setTglTo('');
                setQ('');
                setFilterFrom('');
                setFilterTo('');
                setFilterQ('');
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary ms-2"
              style={{ borderRadius: 6 }}
              onClick={() => {
                resetJurnal();
                setShowJurnal(true);
              }}
            >
              Tambah Jurnal
            </button>
          </form>
          <div className="row g-2 mb-2 no-print">
            <div className="col-auto">
              <div className="p-2 rounded" style={{ background: '#DCFCE7', border: '1px solid #86EFAC', fontSize: 12 }}>
                Saldo Kas: <b>Rp {fmtRp(totalKas)}</b>
              </div>
            </div>
            <div className="col-auto">
              <div className="p-2 rounded" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', fontSize: 12 }}>
                Piutang: <b>Rp {fmtRp(totalPiutang)}</b>
              </div>
            </div>
          </div>
          <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
            <table className="table table-sm" style={{ minWidth: 900, fontSize: 12 }}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tgl</th>
                  <th>Modul</th>
                  <th>Keterangan</th>
                  <th>Debit</th>
                  <th>Kredit</th>
                  <th className="text-end">Nominal</th>
                  <th className="no-print">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jurnalRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-3">
                      Belum ada jurnal
                    </td>
                  </tr>
                ) : (
                  jurnalRows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: 10 }}>
                        {r.no}
                      </td>
                      <td style={{ fontSize: 11 }}>{r.tgl}</td>
                      <td>
                        <span className="bd bd-gray" style={{ fontSize: 10 }}>
                          {r.modul}
                        </span>
                      </td>
                      <td>{r.ket}</td>
                      <td style={{ color: '#DC2626', fontWeight: 600, fontSize: 11 }}>{r.debit}</td>
                      <td style={{ color: '#16A34A', fontWeight: 600, fontSize: 11 }}>{r.kredit}</td>
                      <td className="text-end mono fw-semibold">
                        <Rp n={r.nominal} />
                      </td>
                      <td className="no-print">
                        <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => editJurnal(jurnalMap[r.id] || r)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button type="button" className="btn btn-act btn-outline-danger" onClick={() => onJurnalDelete(r.id)}>
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'neraca' && (
        <>
          <h5 style={{ fontSize: 14, fontWeight: 700, color: '#0F2744', marginBottom: 12 }}>NERACA — Per 31 Desember {tahun}</h5>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="card" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#0F2744', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>ASET</div>
                <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                  <tbody>
                    <tr style={{ background: '#F8FAFF' }}>
                      <td colSpan={2} className="fw-bold ps-3" style={{ color: '#1D4ED8' }}>
                        Aset Lancar
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Kas</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.kas)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Bank</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.bank)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Piutang Toko Anggota</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.piutang_anggota)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Piutang Pinjaman</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.piutang_pin)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Piutang Kredit</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.piutang_kredit)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Persediaan</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.persediaan)} />
                      </td>
                    </tr>
                    <tr style={{ background: '#E0F2FE', fontWeight: 700 }}>
                      <td className="ps-3">Total Aset Lancar</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.total_aset_lancar)} />
                      </td>
                    </tr>
                    <tr style={{ background: '#F8FAFF' }}>
                      <td colSpan={2} className="fw-bold ps-3" style={{ color: '#1D4ED8' }}>
                        Aset Tetap
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Kendaraan & Aset Rental</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.aset_tetap)} />
                      </td>
                    </tr>
                    <tr style={{ background: '#0F2744', color: '#fff', fontWeight: 700 }}>
                      <td className="ps-3">TOTAL ASET</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.total_aset)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#0F2744', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>KEWAJIBAN & EKUITAS</div>
                <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                  <tbody>
                    <tr style={{ background: '#F8FAFF' }}>
                      <td colSpan={2} className="fw-bold ps-3" style={{ color: '#DC2626' }}>
                        Kewajiban
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Simpanan Anggota</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.simpanan_anggota)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Hutang Supplier</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.hutang_supplier)} />
                      </td>
                    </tr>
                    <tr style={{ background: '#F8FAFF' }}>
                      <td colSpan={2} className="fw-bold ps-3" style={{ color: '#16A34A' }}>
                        Ekuitas
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">Modal Koperasi</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.modal_koperasi)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-4">SHU Tahun {tahun}</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.shu_tahun)} />
                      </td>
                    </tr>
                    <tr style={{ background: '#0F2744', color: '#fff', fontWeight: 700 }}>
                      <td className="ps-3">TOTAL KEWAJIBAN + EKUITAS</td>
                      <td className="text-end">
                        <Rp n={Number(neraca.total_pasiva)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'laba_rugi' && (
        <>
          <h5 style={{ fontSize: 14, fontWeight: 700, color: '#0F2744', marginBottom: 12 }}>LAPORAN LABA RUGI — Tahun {tahun}</h5>
          <div className="card" style={{ borderRadius: 8, overflow: 'hidden', maxWidth: 720 }}>
            <div style={{ background: '#16A34A', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>PENDAPATAN & BEBAN</div>
            <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
              <tbody>
                <tr>
                  <td>Pendapatan Bunga Pinjaman</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.pend_bunga_pin)} />
                  </td>
                </tr>
                <tr>
                  <td>Pendapatan Jasa Administrasi</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.pend_jasa_adm)} />
                  </td>
                </tr>
                <tr>
                  <td className="ps-3">Penjualan Toko</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.pend_toko)} />
                  </td>
                </tr>
                <tr>
                  <td className="ps-3">HPP Toko</td>
                  <td className="text-end text-danger">
                    (<Rp n={Number(labaRugi.hpp_toko)} />)
                  </td>
                </tr>
                <tr style={{ background: '#DCFCE7' }}>
                  <td className="ps-3 fw-semibold">Laba Bersih Toko</td>
                  <td className="text-end fw-semibold">
                    <Rp n={Number(labaRugi.laba_toko)} />
                  </td>
                </tr>
                <tr>
                  <td>Pendapatan PPOB</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.pend_ppob)} />
                  </td>
                </tr>
                <tr>
                  <td>Pendapatan Rental</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.pend_rental)} />
                  </td>
                </tr>
                <tr>
                  <td className="ps-3">Labor (kontrak - biaya)</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.laba_labor)} />
                  </td>
                </tr>
                <tr>
                  <td>Pendapatan Lain</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.pend_lain)} />
                  </td>
                </tr>
                <tr style={{ background: '#16A34A', color: '#fff', fontWeight: 700 }}>
                  <td>TOTAL PENDAPATAN</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.total_pendapatan)} />
                  </td>
                </tr>
                <tr>
                  <td>Beban Gaji</td>
                  <td className="text-end text-danger">
                    <Rp n={Number(labaRugi.beban_gaji)} />
                  </td>
                </tr>
                <tr>
                  <td>Beban Operasional</td>
                  <td className="text-end text-danger">
                    <Rp n={Number(labaRugi.beban_ops)} />
                  </td>
                </tr>
                <tr>
                  <td>Beban Lain</td>
                  <td className="text-end text-danger">
                    <Rp n={Number(labaRugi.beban_lain)} />
                  </td>
                </tr>
                <tr style={{ background: '#FEE2E2', fontWeight: 700 }}>
                  <td>TOTAL BEBAN</td>
                  <td className="text-end text-danger">
                    (<Rp n={Number(labaRugi.total_beban)} />)
                  </td>
                </tr>
                <tr style={{ background: '#0F2744', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                  <td>SHU (Sisa Hasil Usaha)</td>
                  <td className="text-end">
                    <Rp n={Number(labaRugi.shu_bruto)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'shu' && (
        <>
          <h5 style={{ fontSize: 14, fontWeight: 700, color: '#0F2744' }}>PEMBAGIAN SHU — Tahun {tahun}</h5>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>Berdasarkan AD/ART Koperasi</p>
          <div className="row g-3">
            <div className="col-md-5">
              <div className="card" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#0F2744', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>ALOKASI SHU</div>
                <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th className="text-center">%</th>
                      <th className="text-end">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#F8FAFF' }}>
                      <td colSpan={3} className="fw-bold">
                        SHU Bruto: <span className="text-success">Rp {fmtRp(shu.bruto)}</span>
                      </td>
                    </tr>
                    {(shu.alokasi || []).map((it) => (
                      <tr key={it.code}>
                        <td style={{ fontWeight: 600 }}>{it.label}</td>
                        <td className="text-center fw-bold">{it.pct}%</td>
                        <td className="text-end mono fw-bold">{fmtRp(it.jumlah)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#0F2744', color: '#fff', fontWeight: 700 }}>
                      <td>TOTAL</td>
                      <td className="text-center">{shu.total_pct}%</td>
                      <td className="text-end mono">{fmtRp(shu.check)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-md-7">
              <div className="card" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#16A34A', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>ESTIMASI SHU per Anggota</div>
                <div className="tbl-wrap p-2" style={{ maxHeight: 320, overflow: 'auto' }}>
                  <table className="table table-sm" style={{ fontSize: 10.5 }}>
                    <thead>
                      <tr>
                        <th>Anggota</th>
                        <th className="text-end">Modal</th>
                        <th className="text-end">SHU Modal</th>
                        <th className="text-end">Pinjaman</th>
                        <th className="text-end">SHU Pinj.</th>
                        <th className="text-end">Konsumsi</th>
                        <th className="text-end">SHU Kons.</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(shu.kontribusi || []).map((r, i) => (
                        <tr key={i}>
                          <td>{r.nama}</td>
                          <td className="text-end mono">{fmtRp(r.modal)}</td>
                          <td className="text-end mono">{fmtRp(r.shu_modal)}</td>
                          <td className="text-end mono">{fmtRp(r.pinjaman)}</td>
                          <td className="text-end mono">{fmtRp(r.shu_pinjaman)}</td>
                          <td className="text-end mono">{fmtRp(r.konsumsi)}</td>
                          <td className="text-end mono">{fmtRp(r.shu_konsumsi)}</td>
                          <td className="text-end mono fw-bold">{fmtRp(r.shu_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="card mt-3" style={{ borderRadius: 8 }}>
            <div style={{ background: '#F8FAFF', padding: '9px 14px', fontWeight: 700, fontSize: 13, color: '#0F2744', borderBottom: '1px solid #E2E8F0' }}>
              Atur Persentase Pembagian SHU
            </div>
            <div className="card-body p-3">
              <form onSubmit={onShuSave} className="row g-2 align-items-end">
                {SHU_FORM.map((f) => (
                  <div className="col-md-3" key={f.key}>
                    <label className="fl" style={{ fontSize: 11 }}>
                      {f.label} (%)
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={shuPct[f.key] ?? ''}
                      onChange={(e) => setShuPct((p) => ({ ...p, [f.key]: e.target.value }))}
                      min={0}
                      max={100}
                      step={0.5}
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                ))}
                <div className="col-md-2">
                  <label className="fl" style={{ fontSize: 11, color: '#0F2744' }}>
                    Total: <b style={{ color: Math.abs(shuTotalPct - 100) < 0.1 ? '#16A34A' : '#DC2626' }}>{shuTotalPct.toFixed(1)}</b>%
                  </label>
                  <button type="submit" className="btn btn-sm btn-navy w-100" disabled={saving}>
                    Simpan
                  </button>
                </div>
              </form>
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 6, marginBottom: 0 }}>Total persentase harus tepat 100%.</p>
            </div>
          </div>
        </>
      )}

      <Modal open={showJurnal} onClose={() => setShowJurnal(false)} title={jurnalTitle} size="md">
        <form onSubmit={onJurnalSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-md-5">
                <label className="fl">Tanggal</label>
                <input type="date" value={jurnalForm.tgl} onChange={(e) => setJurnalForm((f) => ({ ...f, tgl: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-7">
                <label className="fl">Modul</label>
                <select value={jurnalForm.modul} onChange={(e) => setJurnalForm((f) => ({ ...f, modul: e.target.value }))} className="form-select form-select-sm">
                  {MODUL_OPTS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="fl">Keterangan</label>
                <input value={jurnalForm.ket} onChange={(e) => setJurnalForm((f) => ({ ...f, ket: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-6">
                <label className="fl">Akun Debit</label>
                <input value={jurnalForm.debit} onChange={(e) => setJurnalForm((f) => ({ ...f, debit: e.target.value }))} className="form-control form-control-sm" list="coa-list" />
                <datalist id="coa-list">
                  {coaList.map((c) => (
                    <option key={c.nama} value={c.nama} />
                  ))}
                </datalist>
              </div>
              <div className="col-md-6">
                <label className="fl">Akun Kredit</label>
                <input value={jurnalForm.kredit} onChange={(e) => setJurnalForm((f) => ({ ...f, kredit: e.target.value }))} className="form-control form-control-sm" list="coa-list" />
              </div>
              <div className="col-md-6">
                <label className="fl">Nominal (Rp)</label>
                <input type="number" value={jurnalForm.nominal} onChange={(e) => setJurnalForm((f) => ({ ...f, nominal: e.target.value }))} className="form-control form-control-sm" required min={0} />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowJurnal(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}

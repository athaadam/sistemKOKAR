'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ImportModalBody, ModalFooter } from '@/components/crud/ListPageChrome';

type AnggotaRow = {
  id: string;
  no: string;
  nama: string;
  dept?: string;
  nip?: string;
  saldo?: Record<string, number>;
  total_simpanan?: number;
};

type TotalByJenis = { jenis: string; t: number };

type TrxForm = {
  anggota_id: string;
  anggota_nama: string;
  tipe: 'setor' | 'tarik';
  jenis: string;
  metode: string;
  tgl: string;
  nominal: string;
  ket: string;
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

const JENIS_OPTS = [
  { value: 'pokok', label: 'Pokok' },
  { value: 'wajib', label: 'Wajib' },
  { value: 'sukarela', label: 'Sukarela' },
];

const METODE_OPTS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'potong-gaji', label: 'Potong Gaji' },
];

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

const EMPTY_TRX: TrxForm = {
  anggota_id: '',
  anggota_nama: '',
  tipe: 'setor',
  jenis: 'pokok',
  metode: 'tunai',
  tgl: today(),
  nominal: '',
  ket: '',
};

export function SimpananPageContent() {
  const [rows, setRows] = useState<AnggotaRow[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [totalByJenis, setTotalByJenis] = useState<TotalByJenis[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [filterQ, setFilterQ] = useState('');

  const [showTrx, setShowTrx] = useState(false);
  const [trxTitle, setTrxTitle] = useState('Setor Simpanan');
  const [trxForm, setTrxForm] = useState<TrxForm>(EMPTY_TRX);
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const query = filterQ ? `?q=${encodeURIComponent(filterQ)}` : '';
    api
      .get<{ anggota_list: AnggotaRow[]; total_all: number; total_by_jenis: TotalByJenis[] }>(
        `/simpanan${query}`,
      )
      .then((r) => {
        setRows(r.anggota_list || []);
        setTotalAll(Number(r.total_all) || 0);
        setTotalByJenis(r.total_by_jenis || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterQ]);

  useEffect(() => {
    load();
  }, [load]);

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setFilterQ(q);
  }

  function resetSearch() {
    setQ('');
    setFilterQ('');
  }

  function openSetor(row: AnggotaRow) {
    setTrxTitle('Setor Simpanan');
    setTrxForm({ ...EMPTY_TRX, tipe: 'setor', anggota_id: row.id, anggota_nama: row.nama, tgl: today() });
    setShowTrx(true);
  }

  function openTarik(row: AnggotaRow) {
    setTrxTitle('Penarikan Simpanan');
    setTrxForm({ ...EMPTY_TRX, tipe: 'tarik', anggota_id: row.id, anggota_nama: row.nama, tgl: today() });
    setShowTrx(true);
  }

  async function onSaveTrx(e: FormEvent) {
    e.preventDefault();
    if (!trxForm.anggota_id || !trxForm.nominal) {
      setFlash('Isi semua field');
      setFlashType('danger');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/simpanan/save', {
        anggota_id: trxForm.anggota_id,
        tipe: trxForm.tipe,
        jenis: trxForm.jenis,
        metode: trxForm.metode,
        tgl: trxForm.tgl,
        nominal: Number(trxForm.nominal),
        ket: trxForm.ket,
      });
      setFlash(r.message || 'Transaksi berhasil');
      setFlashType('success');
      setShowTrx(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
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
      const r = await api.postForm<{ message?: string }>('/simpanan/import', fd);
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

  function saldo(row: AnggotaRow, jenis: string) {
    return Number(row.saldo?.[jenis] || 0);
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
          <h2>Simpanan Anggota</h2>
          <p>{rows.length} anggota</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl('/simpanan/export?fmt=xlsx')} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">Excel</a>
          <a href={api.exportUrl('/simpanan/export?fmt=csv')} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">CSV</a>
          <button type="button" className="btn btn-sm btn-outline-warning" style={btnStyle} onClick={() => setShowImport(true)}>Import</button>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>Print</button>
          <Link href="/simpanan/trx" className="btn btn-sm btn-navy" style={btnStyle}>Transaksi</Link>
        </div>
      </div>

      <div className="row g-2 mb-3 no-print">
        <div className="col-md-3">
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-val">Rp {fmtRp(totalAll)}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Total Seluruh Simpanan</div>
          </div>
        </div>
        {totalByJenis.map((r) => (
          <div className="col-md-3" key={r.jenis}>
            <div className="stat-card" style={{ cursor: 'default' }}>
              <div className="stat-val" style={{ fontSize: 16 }}>Rp {fmtRp(r.t)}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Simpanan {capitalize(r.jenis)}</div>
            </div>
          </div>
        ))}
      </div>

      <form className="toolbar no-print" onSubmit={applySearch}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / no / NIP..." className="form-control form-control-sm" style={{ width: 240 }} />
        <button type="submit" className="btn btn-sm btn-navy">Cari</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetSearch}>Reset</button>
      </form>

      <div className="tbl-wrap">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>No</th><th>No Ang.</th><th>Nama</th><th>Dept</th>
              <th className="text-end">Pokok</th><th className="text-end">Wajib</th>
              <th className="text-end">Sukarela</th><th className="text-end">Total</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-muted py-4">Belum ada data</td></tr>
            ) : rows.map((a, i) => (
              <tr key={a.id}>
                <td className="text-muted" style={{ fontSize: 11 }}>{i + 1}</td>
                <td><span className="mono">{a.no}</span></td>
                <td className="fw-semibold">{a.nama}</td>
                <td style={{ fontSize: 11, color: '#64748B' }}>{a.dept}</td>
                <td className="text-end mono">{fmtRp(saldo(a, 'pokok'))}</td>
                <td className="text-end mono">{fmtRp(saldo(a, 'wajib'))}</td>
                <td className="text-end mono">{fmtRp(saldo(a, 'sukarela'))}</td>
                <td className="text-end mono fw-bold">{fmtRp(a.total_simpanan)}</td>
                <td className="no-print text-nowrap">
                  <button type="button" className="btn btn-act btn-navy me-1" onClick={() => openSetor(a)}>Setor</button>
                  <button type="button" className="btn btn-act btn-outline-danger" onClick={() => openTarik(a)}>Tarik</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showTrx} onClose={() => setShowTrx(false)} title={trxTitle} size="md">
        <form onSubmit={onSaveTrx}>
          <div className="modal-body">
            <div className="p-2 rounded mb-2" style={{ background: '#EFF6FF', fontSize: 12 }}>
              <b>{trxForm.anggota_nama}</b>
            </div>
            <div className="row g-2">
              <div className="col-md-6">
                <label className="fl">Jenis Simpanan</label>
                <select className="form-select form-select-sm" value={trxForm.jenis} onChange={(e) => setTrxForm({ ...trxForm, jenis: e.target.value })}>
                  {JENIS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Metode</label>
                <select className="form-select form-select-sm" value={trxForm.metode} onChange={(e) => setTrxForm({ ...trxForm, metode: e.target.value })}>
                  {METODE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Tanggal</label>
                <input type="date" className="form-control form-control-sm" value={trxForm.tgl} onChange={(e) => setTrxForm({ ...trxForm, tgl: e.target.value })} required />
              </div>
              <div className="col-md-6">
                <label className="fl">Nominal (Rp)</label>
                <input type="number" className="form-control form-control-sm" value={trxForm.nominal} onChange={(e) => setTrxForm({ ...trxForm, nominal: e.target.value })} required min={1000} />
              </div>
              <div className="col-12">
                <label className="fl">Keterangan</label>
                <input className="form-control form-control-sm" value={trxForm.ket} onChange={(e) => setTrxForm({ ...trxForm, ket: e.target.value })} placeholder="Opsional..." />
              </div>
            </div>
          </div>
          <ModalFooter
            onCancel={() => setShowTrx(false)}
            saving={saving}
            submitLabel={trxForm.tipe === 'setor' ? 'Simpan Setoran' : 'Tarik'}
          />
        </form>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Simpanan (CSV)" size="md">
        <form onSubmit={onImport}>
          <div className="modal-body">
            <ImportModalBody columns="no, nip, nama, pokok, wajib, sukarela" file={importFile} onFile={setImportFile} />
            <p className="text-muted small mb-0">Data diidentifikasi berdasarkan kolom <b>no</b> atau <b>nip</b>.</p>
          </div>
          <ModalFooter onCancel={() => setShowImport(false)} saving={importing} submitLabel="Import" />
        </form>
      </Modal>
    </>
  );
}

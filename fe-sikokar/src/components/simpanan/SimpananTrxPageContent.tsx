'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';

type TrxRow = {
  id: string;
  no: string;
  tgl: string;
  anggota_nama?: string;
  nip?: string;
  jenis?: string;
  tipe?: string;
  nominal?: number;
  metode?: string;
  ket?: string;
};

type AnggotaOpt = { id: string; no: string; nama: string };

type TrxForm = {
  anggota_id: string;
  tipe: string;
  jenis: string;
  tgl: string;
  nominal: string;
  metode: string;
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

const EMPTY: TrxForm = {
  anggota_id: '',
  tipe: 'setor',
  jenis: 'pokok',
  tgl: today(),
  nominal: '',
  metode: 'tunai',
  ket: '',
};

export function SimpananTrxPageContent() {
  const [rows, setRows] = useState<TrxRow[]>([]);
  const [anggotaList, setAnggotaList] = useState<AnggotaOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [tipe, setTipe] = useState('');
  const [filter, setFilter] = useState({ tglFrom: '', tglTo: '', tipe: '' });

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<TrxForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filter.tglFrom) qs.set('tgl_from', filter.tglFrom);
    if (filter.tglTo) qs.set('tgl_to', filter.tglTo);
    if (filter.tipe) qs.set('tipe', filter.tipe);
    const query = qs.toString() ? `?${qs}` : '';

    api
      .get<{ rows: TrxRow[]; anggota_list: AnggotaOpt[] }>(`/simpanan/trx${query}`)
      .then((r) => {
        setRows(r.rows || []);
        setAnggotaList(r.anggota_list || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilter(e: FormEvent) {
    e.preventDefault();
    setFilter({ tglFrom, tglTo, tipe });
  }

  function resetFilter() {
    setTglFrom('');
    setTglTo('');
    setTipe('');
    setFilter({ tglFrom: '', tglTo: '', tipe: '' });
  }

  function openNew() {
    setForm({ ...EMPTY, tgl: today() });
    setShowNew(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form.anggota_id || !form.nominal) {
      setFlash('Isi semua field');
      setFlashType('danger');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/simpanan/save', {
        anggota_id: form.anggota_id,
        tipe: form.tipe,
        jenis: form.jenis,
        tgl: form.tgl,
        nominal: Number(form.nominal),
        metode: form.metode,
        ket: form.ket,
      });
      setFlash(r.message || 'Transaksi berhasil');
      setFlashType('success');
      setShowNew(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
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
          <h2>Transaksi Simpanan</h2>
          <p>{rows.length} transaksi</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl('/simpanan/export?fmt=xlsx')} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">Excel</a>
          <a href={api.exportUrl('/simpanan/export?fmt=csv')} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">CSV</a>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>Print</button>
          <Link href="/simpanan" className="btn btn-sm btn-outline-secondary" style={btnStyle}>Kembali</Link>
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openNew}>Transaksi Baru</button>
        </div>
      </div>

      <form className="toolbar no-print" onSubmit={applyFilter}>
        <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Tanggal:</label>
        <input type="date" value={tglFrom} onChange={(e) => setTglFrom(e.target.value)} className="form-control form-control-sm" style={{ width: 145 }} />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>s/d</span>
        <input type="date" value={tglTo} onChange={(e) => setTglTo(e.target.value)} className="form-control form-control-sm" style={{ width: 145 }} />
        <select value={tipe} onChange={(e) => setTipe(e.target.value)} className="form-select form-select-sm" style={{ width: 120 }}>
          <option value="">Semua</option>
          <option value="setor">Setoran</option>
          <option value="tarik">Penarikan</option>
        </select>
        <button type="submit" className="btn btn-sm btn-navy">Filter</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilter}>Reset</button>
      </form>

      <div className="tbl-wrap">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>No Trx</th><th>Tanggal</th><th>Anggota</th><th>Jenis</th>
              <th>Tipe</th><th className="text-end">Nominal</th><th>Metode</th><th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted py-4">Belum ada transaksi</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td><span className="mono" style={{ fontSize: 11 }}>{r.no}</span></td>
                <td>{r.tgl}</td>
                <td className="fw-semibold">
                  {r.anggota_nama}
                  {r.nip && <><br /><span className="text-muted" style={{ fontSize: 10 }}>{r.nip}</span></>}
                </td>
                <td><span className="bd bd-navy">{r.jenis}</span></td>
                <td>
                  <span className={`bd ${r.tipe === 'setor' ? 'bd-green' : 'bd-red'}`}>
                    {r.tipe === 'setor' ? 'Setoran' : 'Penarikan'}
                  </span>
                </td>
                <td className={`text-end mono fw-semibold ${r.tipe === 'setor' ? 'text-success' : 'text-danger'}`}>
                  {r.tipe === 'setor' ? '+' : '-'}Rp {fmtRp(r.nominal)}
                </td>
                <td style={{ fontSize: 11 }}>{r.metode}</td>
                <td style={{ fontSize: 11, maxWidth: 200 }}>{r.ket || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Transaksi Simpanan Baru" size="md">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-12">
                <label className="fl">Anggota *</label>
                <select className="form-select form-select-sm" value={form.anggota_id} onChange={(e) => setForm({ ...form, anggota_id: e.target.value })} required>
                  <option value="">— Pilih Anggota —</option>
                  {anggotaList.map((a) => (
                    <option key={a.id} value={a.id}>{a.no} — {a.nama}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Tipe</label>
                <select className="form-select form-select-sm" value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })}>
                  <option value="setor">Setoran</option>
                  <option value="tarik">Penarikan</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Jenis</label>
                <select className="form-select form-select-sm" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
                  {JENIS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Tanggal</label>
                <input type="date" className="form-control form-control-sm" value={form.tgl} onChange={(e) => setForm({ ...form, tgl: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="fl">Nominal</label>
                <input type="number" className="form-control form-control-sm" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} required />
              </div>
              <div className="col-md-6">
                <label className="fl">Metode</label>
                <select className="form-select form-select-sm" value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value })}>
                  {METODE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Keterangan</label>
                <input className="form-control form-control-sm" value={form.ket} onChange={(e) => setForm({ ...form, ket: e.target.value })} />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowNew(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}

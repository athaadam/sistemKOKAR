'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';
import { Modal } from '@/components/crud/Modal';
import { ImportModalBody, ModalFooter } from '@/components/crud/ListPageChrome';

type Lokasi = { id: string; nama: string };

type PenjualanRow = {
  id: string;
  no: string;
  tgl: string;
  lokasi_nama?: string;
  jenis?: string;
  payment_channel?: string;
  anggota_nama?: string;
  items_text?: string;
  subtotal?: number;
  diskon_total?: number;
  total?: number;
  status?: string;
  void?: number;
};

type EditForm = {
  id: string;
  no: string;
  tgl: string;
  jenis: string;
  payment_channel: string;
  diskon_total: string;
  total: string;
  status: string;
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

const JENIS_OPTS = [
  { value: 'cash', label: 'Cash' },
  { value: 'kredit', label: 'Kredit' },
  { value: 'potong_gaji', label: 'Potong Gaji' },
];

const CHANNEL_OPTS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'qris', label: 'QRIS' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'kredit', label: 'Kredit' },
  { value: 'potong_gaji', label: 'Potong Gaji' },
];

const STATUS_OPTS = [
  { value: 'lunas', label: 'Lunas' },
  { value: 'pending', label: 'Pending' },
  { value: 'void', label: 'Void' },
];

function rowToForm(r: PenjualanRow): EditForm {
  return {
    id: r.id,
    no: r.no || '',
    tgl: r.tgl || '',
    jenis: r.jenis || 'cash',
    payment_channel: r.payment_channel || r.jenis || 'cash',
    diskon_total: String(r.diskon_total ?? 0),
    total: String(r.total ?? 0),
    status: r.void ? 'void' : r.status || 'lunas',
  };
}

export default function TokoRiwayatPage() {
  const [rows, setRows] = useState<PenjualanRow[]>([]);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [lok, setLok] = useState('');
  const [jenis, setJenis] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState({ tglFrom: '', tglTo: '', lok: '', jenis: '', q: '' });

  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const exportQs = new URLSearchParams();
  if (filter.tglFrom) exportQs.set('tgl_from', filter.tglFrom);
  if (filter.tglTo) exportQs.set('tgl_to', filter.tglTo);
  const exportSuffix = exportQs.toString() ? `&${exportQs}` : '';

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filter.tglFrom) qs.set('tgl_from', filter.tglFrom);
    if (filter.tglTo) qs.set('tgl_to', filter.tglTo);
    if (filter.lok) qs.set('lok', filter.lok);
    if (filter.jenis) qs.set('jenis', filter.jenis);
    if (filter.q) qs.set('q', filter.q);
    const query = qs.toString() ? `?${qs}` : '';

    api
      .get<{ rows: PenjualanRow[]; lokasi_list: Lokasi[]; total: number }>(`/toko/riwayat${query}`)
      .then((r) => {
        setRows(r.rows || []);
        setLokasiList(r.lokasi_list || []);
        setTotal(Number(r.total) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilter(e: FormEvent) {
    e.preventDefault();
    setFilter({ tglFrom, tglTo, lok, jenis, q });
  }

  function resetFilter() {
    setTglFrom('');
    setTglTo('');
    setLok('');
    setJenis('');
    setQ('');
    setFilter({ tglFrom: '', tglTo: '', lok: '', jenis: '', q: '' });
  }

  function openEdit(row: PenjualanRow) {
    setForm(rowToForm(row));
    setShowEdit(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/toko/riwayat/save', {
        id: form.id,
        tgl: form.tgl,
        jenis: form.jenis,
        payment_channel: form.payment_channel,
        diskon_total: Number(form.diskon_total) || 0,
        total: Number(form.total) || 0,
        status: form.status,
      });
      setFlash(r.message || 'Transaksi penjualan diperbarui');
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

  async function onVoid(row: PenjualanRow) {
    if (!confirm('Void/refund transaksi ini?')) return;
    try {
      const r = await api.post<{ message?: string }>(`/toko/void/${row.id}`, {
        alasan: 'Void/refund dari riwayat',
      });
      setFlash(r.message || 'Transaksi dibatalkan');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal void');
      setFlashType('danger');
    }
  }

  async function onDelete(row: PenjualanRow) {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/toko/riwayat/${row.id}`);
      setFlash(r.message || 'Transaksi dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal hapus');
      setFlashType('danger');
    }
  }

  function openStruk(id: string) {
    window.open(`/toko/struk/${id}`, '_blank', 'width=420,height=640');
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const r = await api.postForm<{ message?: string }>('/toko/riwayat/import', fd);
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
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.history_custom} size={24} style={{ marginRight: 8 }} />
            History Penjualan
          </h2>
          <p>{rows.length} transaksi — Total Rp {fmtRp(total)}</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl(`/toko/riwayat/export?fmt=xlsx${exportSuffix}`)} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">Excel</a>
          <a href={api.exportUrl(`/toko/riwayat/export?fmt=csv${exportSuffix}`)} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">CSV</a>
          <button type="button" className="btn btn-sm btn-outline-warning" style={btnStyle} onClick={() => setShowImport(true)}>Import</button>
          <Link href="/toko" className="btn btn-sm btn-navy" style={btnStyle}>Kasir</Link>
        </div>
      </div>

      <form className="toolbar no-print" onSubmit={applyFilter}>
        <input type="date" value={tglFrom} onChange={(e) => setTglFrom(e.target.value)} className="form-control form-control-sm" style={{ width: 145 }} />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>s/d</span>
        <input type="date" value={tglTo} onChange={(e) => setTglTo(e.target.value)} className="form-control form-control-sm" style={{ width: 145 }} />
        <select value={lok} onChange={(e) => setLok(e.target.value)} className="form-select form-select-sm" style={{ width: 140 }}>
          <option value="">Semua Toko</option>
          {lokasiList.map((l) => <option key={l.id} value={l.id}>{l.nama}</option>)}
        </select>
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="form-select form-select-sm" style={{ width: 130 }}>
          <option value="">Semua Jenis</option>
          {JENIS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="No / Anggota..." className="form-control form-control-sm" style={{ width: 170 }} />
        <button type="submit" className="btn btn-sm btn-navy">Filter</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilter}>Reset</button>
      </form>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0" style={{ minWidth: 1050, fontSize: 11 }}>
          <thead>
            <tr>
              <th>No Transaksi</th><th>Tanggal</th><th>Toko</th><th>Jenis</th><th>Channel</th>
              <th>Anggota</th><th>Barang Terjual</th>
              <th className="text-end">Subtotal</th><th className="text-end">Diskon</th><th className="text-end">Total</th>
              <th>Status</th><th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="text-center text-muted py-4">Belum ada transaksi</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td><button type="button" className="btn btn-link btn-sm p-0 mono text-decoration-none" onClick={() => openStruk(r.id)}>{r.no}</button></td>
                <td>{r.tgl}</td><td>{r.lokasi_nama}</td>
                <td><span className="bd bd-blue">{r.jenis}</span></td>
                <td>{r.payment_channel || r.jenis}</td>
                <td>{r.anggota_nama || '—'}</td>
                <td style={{ minWidth: 260 }}>{r.items_text || '—'}</td>
                <td className="text-end mono">{fmtRp(r.subtotal)}</td>
                <td className="text-end mono">{fmtRp(r.diskon_total)}</td>
                <td className="text-end mono fw-bold">{fmtRp(r.total)}</td>
                <td>{r.void ? 'void' : r.status}</td>
                <td className="no-print text-nowrap">
                  <button type="button" className="btn btn-act btn-outline-info me-1" title="Export Struk" onClick={() => openStruk(r.id)}><i className="bi bi-receipt" /></button>
                  <button type="button" className="btn btn-act btn-outline-primary me-1" title="Edit" onClick={() => openEdit(r)}><i className="bi bi-pencil" /></button>
                  {!r.void && <button type="button" className="btn btn-act btn-outline-warning me-1" title="Void" onClick={() => onVoid(r)}><i className="bi bi-arrow-counterclockwise" /></button>}
                  <button type="button" className="btn btn-act btn-outline-danger" title="Hapus" onClick={() => onDelete(r)}><i className="bi bi-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><td colSpan={9} className="text-end fw-bold">TOTAL</td><td className="text-end mono fw-bold">Rp {fmtRp(total)}</td><td colSpan={2} /></tr></tfoot>
          )}
        </table>
      </div>

      <Modal open={showEdit && !!form} onClose={() => setShowEdit(false)} title="Edit Transaksi" size="md">
        {form && (
          <form onSubmit={onSave}>
            <div className="modal-body">
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="fl">No</label>
                  <input className="form-control form-control-sm" value={form.no} readOnly />
                </div>
                <div className="col-md-6">
                  <label className="fl">Tanggal</label>
                  <input type="date" className="form-control form-control-sm" value={form.tgl} onChange={(e) => setForm({ ...form, tgl: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="fl">Jenis</label>
                  <select className="form-select form-select-sm" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
                    {JENIS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="fl">Channel</label>
                  <select className="form-select form-select-sm" value={form.payment_channel} onChange={(e) => setForm({ ...form, payment_channel: e.target.value })}>
                    {CHANNEL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="fl">Diskon Total</label>
                  <input type="number" className="form-control form-control-sm" value={form.diskon_total} onChange={(e) => setForm({ ...form, diskon_total: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="fl">Total</label>
                  <input type="number" className="form-control form-control-sm" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="fl">Status</label>
                  <select className="form-select form-select-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
          </form>
        )}
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Penjualan CSV" size="md">
        <form onSubmit={onImport}>
          <div className="modal-body">
            <ImportModalBody columns="no,tgl,lokasi_id,jenis,subtotal,diskon_total,ppn_total,total,status,payment_channel" file={importFile} onFile={setImportFile} />
          </div>
          <ModalFooter onCancel={() => setShowImport(false)} saving={importing} submitLabel="Import" />
        </form>
      </Modal>
    </>
  );
}

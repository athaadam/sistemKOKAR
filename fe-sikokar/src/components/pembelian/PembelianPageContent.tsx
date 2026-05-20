'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type Supplier = { id: string; nama: string };
type Lokasi = { id: string; nama: string };
type Barang = { id: string; nama: string; satuan?: string; harga_beli?: number };

type PembelianItem = {
  barang_id: string;
  barang_nama?: string;
  nama?: string;
  qty: number;
  harga_beli: number;
};

type PembelianRow = {
  id: string;
  no: string;
  tgl: string;
  supplier_id?: string;
  supplier_nama?: string;
  lokasi_id?: string;
  lokasi_nama?: string;
  total?: number;
  status?: string;
  catatan?: string;
  items?: PembelianItem[];
};

type ItemRow = { barang_id: string; qty: number; harga_beli: number };

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function PembelianPageContent() {
  const [rows, setRows] = useState<PembelianRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState({ tglFrom: '', tglTo: '', q: '' });

  const [showEdit, setShowEdit] = useState(false);
  const [modalTitle, setModalTitle] = useState('Buat Pembelian Baru');
  const [pbId, setPbId] = useState('');
  const [tgl, setTgl] = useState(today());
  const [supplierId, setSupplierId] = useState('');
  const [lokasiId, setLokasiId] = useState('L1');
  const [status, setStatus] = useState('lunas');
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ barang_id: '', qty: 1, harga_beli: 0 }]);
  const [saving, setSaving] = useState(false);

  const exportQs = new URLSearchParams();
  if (filter.tglFrom) exportQs.set('tgl_from', filter.tglFrom);
  if (filter.tglTo) exportQs.set('tgl_to', filter.tglTo);
  const exportSuffix = exportQs.toString() ? `&${exportQs}` : '';

  const listTotal = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const formTotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.harga_beli) || 0), 0);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filter.tglFrom) qs.set('tgl_from', filter.tglFrom);
    if (filter.tglTo) qs.set('tgl_to', filter.tglTo);
    if (filter.q) qs.set('q', filter.q);
    const query = qs.toString() ? `?${qs}` : '';

    api
      .get<{
        rows: PembelianRow[];
        suppliers: Supplier[];
        lokasi_list: Lokasi[];
        barang_list: Barang[];
      }>(`/pembelian${query}`)
      .then((r) => {
        setRows(r.rows || []);
        setSuppliers(r.suppliers || []);
        setLokasiList(r.lokasi_list || []);
        setBarangList(r.barang_list || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilter(e: FormEvent) {
    e.preventDefault();
    setFilter({ tglFrom, tglTo, q });
  }

  function resetFilter() {
    setTglFrom('');
    setTglTo('');
    setQ('');
    setFilter({ tglFrom: '', tglTo: '', q: '' });
  }

  function resetForm() {
    setModalTitle('Buat Pembelian Baru');
    setPbId('');
    setTgl(today());
    setSupplierId('');
    setLokasiId(lokasiList[0]?.id || 'L1');
    setStatus('lunas');
    setCatatan('');
    setItems([{ barang_id: '', qty: 1, harga_beli: 0 }]);
  }

  function openAdd() {
    resetForm();
    setShowEdit(true);
  }

  function openEdit(row: PembelianRow) {
    setModalTitle(`Edit Pembelian: ${row.no}`);
    setPbId(row.id);
    setTgl(row.tgl || today());
    setSupplierId(row.supplier_id || '');
    setLokasiId(row.lokasi_id || 'L1');
    setStatus(row.status || 'lunas');
    setCatatan(row.catatan || '');
    const its = row.items?.length
      ? row.items.map((it) => ({
          barang_id: it.barang_id,
          qty: Number(it.qty) || 1,
          harga_beli: Number(it.harga_beli) || 0,
        }))
      : [{ barang_id: '', qty: 1, harga_beli: 0 }];
    setItems(its);
    setShowEdit(true);
  }

  function addItemRow() {
    setItems((prev) => [...prev, { barang_id: '', qty: 1, harga_beli: 0 }]);
  }

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function onBarangChange(idx: number, barangId: string) {
    const b = barangList.find((x) => x.id === barangId);
    updateItem(idx, { barang_id: barangId, harga_beli: b?.harga_beli || 0 });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const valid = items.filter((it) => it.barang_id && Number(it.qty) > 0);
    if (!valid.length) {
      setFlash('Tambahkan minimal satu barang');
      setFlashType('danger');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/pembelian/save', {
        id: pbId,
        tgl,
        supplier_id: supplierId,
        lokasi_id: lokasiId,
        status,
        catatan,
        barang_id: valid.map((it) => it.barang_id),
        qty: valid.map((it) => it.qty),
        harga_beli: valid.map((it) => it.harga_beli),
      });
      setFlash(r.message || 'Pembelian disimpan');
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

  async function onDelete(row: PembelianRow) {
    if (!confirm('Hapus transaksi ini? Stok akan dikembalikan.')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/pembelian/delete/${row.id}`);
      setFlash(r.message || 'Pembelian dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal hapus');
      setFlashType('danger');
    }
  }

  function openPrint(id: string) {
    window.open(`/pembelian/print/${id}`, '_blank', 'width=800,height=700');
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
            <IconRenderer icon={ICON_MAP.pembelian_custom} size={24} style={{ marginRight: 8 }} />
            Pembelian Barang
          </h2>
          <p>{rows.length} transaksi ditemukan</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl(`/pembelian/export?fmt=xlsx${exportSuffix}`)} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">Excel</a>
          <a href={api.exportUrl(`/pembelian/export?fmt=csv${exportSuffix}`)} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">CSV</a>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>Print</button>
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openAdd}>Buat Pembelian</button>
        </div>
      </div>

      <form className="toolbar no-print" onSubmit={applyFilter}>
        <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Tanggal:</label>
        <input type="date" value={tglFrom} onChange={(e) => setTglFrom(e.target.value)} className="form-control form-control-sm" style={{ width: 145 }} />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>s/d</span>
        <input type="date" value={tglTo} onChange={(e) => setTglTo(e.target.value)} className="form-control form-control-sm" style={{ width: 145 }} />
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="No pembelian..." className="form-control form-control-sm" style={{ width: 160 }} />
        <button type="submit" className="btn btn-sm btn-navy">Filter</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilter}>Reset</button>
      </form>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>No Pembelian</th><th>Tanggal</th><th>Supplier</th><th>Toko</th>
              <th className="text-end">Total</th><th>Status</th><th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted py-4">Belum ada data pembelian</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td><span className="mono fw-semibold">{r.no}</span></td>
                <td>{r.tgl}</td>
                <td>{r.supplier_nama || '—'}</td>
                <td><span className="bd bd-navy">{r.lokasi_nama}</span></td>
                <td className="text-end mono fw-semibold">Rp {fmtRp(r.total)}</td>
                <td><span className={`bd ${r.status === 'lunas' ? 'bd-green' : 'bd-amber'}`}>{r.status}</span></td>
                <td className="no-print text-nowrap">
                  <button type="button" className="btn btn-act btn-outline-info me-1" title="Cetak" onClick={() => openPrint(r.id)}><i className="bi bi-printer" /></button>
                  <button type="button" className="btn btn-act btn-outline-primary me-1" title="Edit" onClick={() => openEdit(r)}><i className="bi bi-pencil" /></button>
                  <button type="button" className="btn btn-act btn-outline-danger" title="Hapus" onClick={() => onDelete(r)}><i className="bi bi-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><td colSpan={4} className="text-end fw-bold">TOTAL</td><td className="text-end mono fw-bold">Rp {fmtRp(listTotal)}</td><td colSpan={2} /></tr></tfoot>
          )}
        </table>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={modalTitle} size="xl">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <label className="fl">Tanggal *</label>
                <input type="date" className="form-control form-control-sm" value={tgl} onChange={(e) => setTgl(e.target.value)} required />
              </div>
              <div className="col-md-4">
                <label className="fl">Supplier</label>
                <select className="form-select form-select-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— Pilih Supplier —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="fl">Toko / Lokasi</label>
                <select className="form-select form-select-sm" value={lokasiId} onChange={(e) => setLokasiId(e.target.value)}>
                  {lokasiList.map((l) => <option key={l.id} value={l.id}>{l.nama}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="fl">Status</label>
                <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="lunas">Lunas</option>
                  <option value="hutang">Hutang</option>
                </select>
              </div>
              <div className="col-12">
                <label className="fl">Catatan</label>
                <input className="form-control form-control-sm" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional..." />
              </div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, border: '1px solid #E2E8F0' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <b style={{ fontSize: 13 }}>Detail Barang</b>
                <button type="button" className="btn btn-sm btn-navy" onClick={addItemRow}>Tambah Baris</button>
              </div>
              <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Barang</th><th>Qty</th><th>Harga Beli</th><th className="text-end">Subtotal</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const sub = (Number(it.qty) || 0) * (Number(it.harga_beli) || 0);
                    return (
                      <tr key={idx}>
                        <td>
                          <select className="form-select form-select-sm" value={it.barang_id} onChange={(e) => onBarangChange(idx, e.target.value)}>
                            <option value="">— Pilih —</option>
                            {barangList.map((b) => <option key={b.id} value={b.id}>{b.nama} ({b.satuan || 'PCS'})</option>)}
                          </select>
                        </td>
                        <td><input type="number" min={1} className="form-control form-control-sm" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} /></td>
                        <td><input type="number" min={0} className="form-control form-control-sm" value={it.harga_beli} onChange={(e) => updateItem(idx, { harga_beli: Number(e.target.value) })} /></td>
                        <td className="text-end mono">Rp {fmtRp(sub)}</td>
                        <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeItem(idx)}><i className="bi bi-trash" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-end mt-2"><b>Total: </b><span className="mono fw-bold">Rp {fmtRp(formTotal)}</span></div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} submitLabel="Simpan Pembelian" />
        </form>
      </Modal>
    </>
  );
}

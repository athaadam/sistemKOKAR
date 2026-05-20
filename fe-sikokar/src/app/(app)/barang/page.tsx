'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ImportModalBody, ListPageHeader, ModalFooter } from '@/components/crud/ListPageChrome';
import { ICON_MAP } from '@/components/ui/IconRenderer';

const KAT_STD = [
  'Sembako',
  'Makanan',
  'Minuman',
  'Perawatan',
  'Kebersihan',
  'Elektronik',
  'Pakaian',
  'Alat Tulis',
  'Lainnya',
];

type BarangRow = {
  id: string;
  kode: string;
  barcode?: string;
  nama: string;
  kategori?: string;
  satuan?: string;
  harga_beli?: number;
  harga?: number;
  tipe?: string;
  supplier_id?: string | null;
  is_taxable?: number;
  stok_l1?: number;
  stok_l2?: number;
};

type RefOption = { value?: string; label: string };
type Supplier = { id: string; nama: string };

type BarangForm = {
  id: string;
  kode: string;
  barcode: string;
  nama: string;
  kategori_sel: string;
  kategori: string;
  satuan: string;
  harga_beli: string;
  harga: string;
  tipe: string;
  supplier_id: string;
  is_taxable: boolean;
};

const EMPTY: BarangForm = {
  id: '',
  kode: '',
  barcode: '',
  nama: '',
  kategori_sel: '',
  kategori: '',
  satuan: '',
  harga_beli: '0',
  harga: '0',
  tipe: 'regular',
  supplier_id: '',
  is_taxable: false,
};

function rowToForm(r: BarangRow): BarangForm {
  const kat = r.kategori || '';
  const std = KAT_STD.includes(kat);
  return {
    id: r.id,
    kode: r.kode || '',
    barcode: r.barcode || '',
    nama: r.nama || '',
    kategori_sel: std ? kat : kat ? '__tambah__' : '',
    kategori: kat,
    satuan: r.satuan || '',
    harga_beli: String(r.harga_beli ?? 0),
    harga: String(r.harga ?? 0),
    tipe: r.tipe || 'regular',
    supplier_id: r.supplier_id || '',
    is_taxable: r.is_taxable === 1,
  };
}

export default function BarangPage() {
  const [rows, setRows] = useState<BarangRow[]>([]);
  const [kats, setKats] = useState<{ kategori: string }[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [satuanOptions, setSatuanOptions] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [kat, setKat] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterKat, setFilterKat] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Barang');
  const [form, setForm] = useState<BarangForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const extraKats = kats.map((k) => k.kategori).filter((k) => k && !KAT_STD.includes(k));

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filterQ) qs.set('q', filterQ);
    if (filterKat) qs.set('kat', filterKat);
    const query = qs.toString() ? `?${qs}` : '';

    api
      .get<{
        rows: BarangRow[];
        kats: { kategori: string }[];
        suppliers: Supplier[];
        satuan_options: RefOption[];
      }>(`/barang${query}`)
      .then((r) => {
        setRows(r.rows || []);
        setKats(r.kats || []);
        setSuppliers(r.suppliers || []);
        setSatuanOptions(r.satuan_options || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterQ, filterKat]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof BarangForm>(key: K, value: BarangForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setModalTitle('Tambah Barang');
    setForm({ ...EMPTY });
    setShowEdit(true);
  }

  function openEdit(row: BarangRow) {
    setModalTitle(`Edit: ${row.nama}`);
    setForm(rowToForm(row));
    setShowEdit(true);
  }

  function onKatSelChange(val: string) {
    setField('kategori_sel', val);
    if (val === '__tambah__') setField('kategori', '');
    else setField('kategori', val);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const kategori =
      form.kategori_sel === '__tambah__' ? form.kategori.trim() : form.kategori_sel || form.kategori;
    if (!kategori) {
      setFlash('Kategori wajib dipilih');
      setFlashType('danger');
      return;
    }
    setSaving(true);
    setFlash('');
    try {
      const body = {
        id: form.id,
        kode: form.kode,
        barcode: form.barcode,
        nama: form.nama,
        kategori,
        satuan: form.satuan,
        harga_beli: form.harga_beli,
        harga: form.harga,
        tipe: form.tipe,
        supplier_id: form.supplier_id || null,
        is_taxable: form.is_taxable ? 1 : 0,
      };
      const r = await api.post<{ message?: string }>('/barang/save', body);
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

  async function onDelete(row: BarangRow) {
    if (!confirm('Hapus barang?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/barang/${row.id}`);
      setFlash(r.message || 'Barang dihapus');
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
      const r = await api.postForm<{ message?: string }>('/barang/import', fd);
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
        icon={ICON_MAP.package_custom}
        title="Barang & Stok"
        subtitle={`${rows.length} barang ditemukan`}
        exportPath="/barang/export"
        onImport={() => setShowImport(true)}
        onAdd={openAdd}
        addLabel="Tambah"
      />

      <form
        className="toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          setFilterQ(q);
          setFilterKat(kat);
        }}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / kode / barcode..."
          className="form-control form-control-sm"
          style={{ width: 220, borderRadius: 6 }}
        />
        <select
          value={kat}
          onChange={(e) => setKat(e.target.value)}
          className="form-select form-select-sm"
          style={{ width: 160, borderRadius: 6 }}
        >
          <option value="">Semua Kategori</option>
          {KAT_STD.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
          {extraKats.map((k) => (
            <option key={k} value={k}>
              {k}
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
            setKat('');
            setFilterQ('');
            setFilterKat('');
          }}
        >
          Reset
        </button>
      </form>

      <div className="tbl-wrap tbl-scroll-x">
        <table className="table table-sm mb-0" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Barcode</th>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th>Satuan</th>
              <th className="text-end">H. Beli</th>
              <th className="text-end">H. Jual</th>
              <th className="text-end">Stok KM1</th>
              <th className="text-end">Stok KM2</th>
              <th>Pajak</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center text-muted py-4">
                  Belum ada data barang
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono">{r.kode}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 10 }}>
                      {r.barcode}
                    </span>
                  </td>
                  <td className="fw-semibold">
                    {r.nama}
                    <br />
                    <span className="bd bd-gray" style={{ fontSize: 10 }}>
                      {r.tipe}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.kategori}</td>
                  <td style={{ fontSize: 11 }}>{r.satuan}</td>
                  <td className="text-end mono">{fmtRp(r.harga_beli)}</td>
                  <td className="text-end mono fw-semibold">{fmtRp(r.harga)}</td>
                  <td className={`text-end mono ${(r.stok_l1 ?? 0) < 10 ? 'text-danger' : ''}`}>
                    {Math.round(r.stok_l1 ?? 0)}
                  </td>
                  <td className={`text-end mono ${(r.stok_l2 ?? 0) < 10 ? 'text-danger' : ''}`}>
                    {Math.round(r.stok_l2 ?? 0)}
                  </td>
                  <td>
                    {r.is_taxable ? (
                      <span className="bd bd-amber">PPN</span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 10 }}>—</span>
                    )}
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

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={modalTitle}>
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-md-4">
                <label className="fl">Kode *</label>
                <input
                  value={form.kode}
                  onChange={(e) => setField('kode', e.target.value)}
                  className="form-control form-control-sm"
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Barcode</label>
                <input
                  value={form.barcode}
                  onChange={(e) => setField('barcode', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Satuan</label>
                <select
                  value={form.satuan}
                  onChange={(e) => setField('satuan', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="">— Pilih Satuan —</option>
                  {satuanOptions.map((o) => (
                    <option key={o.value || o.label} value={o.value || o.label}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <small className="text-muted" style={{ fontSize: 10 }}>
                  Kelola daftar di Setting — Master Data
                </small>
              </div>
              <div className="col-md-8">
                <label className="fl">Nama Barang *</label>
                <input
                  value={form.nama}
                  onChange={(e) => setField('nama', e.target.value)}
                  className="form-control form-control-sm"
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Kategori</label>
                <select
                  value={form.kategori_sel}
                  onChange={(e) => onKatSelChange(e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="">— Pilih Kategori —</option>
                  {KAT_STD.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                  {extraKats.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                  <option value="__tambah__">➕ Tambah Kategori Baru...</option>
                </select>
                {form.kategori_sel === '__tambah__' && (
                  <input
                    value={form.kategori}
                    onChange={(e) => setField('kategori', e.target.value)}
                    className="form-control form-control-sm mt-1"
                    placeholder="Ketik kategori baru..."
                  />
                )}
              </div>
              <div className="col-md-4">
                <label className="fl">Harga Beli</label>
                <input
                  type="number"
                  value={form.harga_beli}
                  onChange={(e) => setField('harga_beli', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Harga Jual</label>
                <input
                  type="number"
                  value={form.harga}
                  onChange={(e) => setField('harga', e.target.value)}
                  className="form-control form-control-sm"
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Tipe</label>
                <select
                  value={form.tipe}
                  onChange={(e) => setField('tipe', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="regular">Regular</option>
                  <option value="konsinyasi">Konsinyasi</option>
                </select>
              </div>
              <div className="col-md-8">
                <label className="fl">Supplier</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setField('supplier_id', e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="">— Pilih Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4 d-flex align-items-end pb-1">
                <div className="form-check">
                  <input
                    type="checkbox"
                    id="f_is_taxable"
                    className="form-check-input"
                    checked={form.is_taxable}
                    onChange={(e) => setField('is_taxable', e.target.checked)}
                  />
                  <label htmlFor="f_is_taxable" className="form-check-label" style={{ fontSize: 12 }}>
                    Kena PPN
                  </label>
                </div>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Barang (CSV)" size="md">
        <form onSubmit={onImport}>
          <div className="modal-body">
            <ImportModalBody
              columns="kode, barcode, nama, kategori, satuan, harga_beli, harga, tipe, is_taxable"
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

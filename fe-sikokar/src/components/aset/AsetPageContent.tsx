'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';

type AsetRow = {
  id: string;
  no: string;
  nama: string;
  kategori: string;
  tgl_perolehan: string;
  harga_beli: number;
  umur_ekonomis: number;
  nilai_residu: number;
  akum_calc: number;
  nilai_buku_calc: number;
  metode_susut?: string;
  catatan?: string;
};

const KATEGORI = ['Bangunan', 'Kendaraan', 'Peralatan', 'Inventaris', 'Mesin'];

const EMPTY = {
  id: '',
  nama: '',
  kategori: 'Bangunan',
  tgl_perolehan: today(),
  harga_beli: '0',
  umur_ekonomis: '5',
  nilai_residu: '0',
  metode_susut: 'garis-lurus',
  catatan: '',
};

export function AsetPageContent() {
  const [rows, setRows] = useState<AsetRow[]>([]);
  const [totalHarga, setTotalHarga] = useState(0);
  const [totalAkum, setTotalAkum] = useState(0);
  const [totalBuku, setTotalBuku] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: AsetRow[]; total_harga: number; total_akum: number; total_buku: number }>('/aset')
      .then((r) => {
        setRows(r.rows || []);
        setTotalHarga(Number(r.total_harga) || 0);
        setTotalAkum(Number(r.total_akum) || 0);
        setTotalBuku(Number(r.total_buku) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({ ...EMPTY, tgl_perolehan: today() });
    setShowEdit(true);
  }

  function openEdit(row: AsetRow) {
    setForm({
      id: row.id,
      nama: row.nama,
      kategori: row.kategori || 'Bangunan',
      tgl_perolehan: row.tgl_perolehan,
      harga_beli: String(row.harga_beli || 0),
      umur_ekonomis: String(row.umur_ekonomis || 5),
      nilai_residu: String(row.nilai_residu || 0),
      metode_susut: row.metode_susut || 'garis-lurus',
      catatan: row.catatan || '',
    });
    setShowEdit(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/aset', {
        ...form,
        harga_beli: Number(form.harga_beli) || 0,
        umur_ekonomis: Number(form.umur_ekonomis) || 5,
        nilai_residu: Number(form.nilai_residu) || 0,
      });
      setFlash(r.message || 'Aset tersimpan');
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

  async function onDepresiasi(row: AsetRow) {
    if (!confirm('Posting penyusutan bulan ini?')) return;
    try {
      const r = await api.post<{ message?: string }>(`/aset/depresiasi/${row.id}`, {});
      setFlash(r.message || 'Penyusutan diposting');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal posting');
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
      <div className="mb-2 no-print">
        <Link href="/pembukuan" className="btn btn-sm btn-outline-secondary">
          ← Kembali ke Pembukuan
        </Link>
      </div>
      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>🏢 Aset Tetap</h2>
          <p>
            {rows.length} aset · Harga: Rp {fmtRp(totalHarga)} · Akum: Rp {fmtRp(totalAkum)} · Nilai Buku:{' '}
            <b>Rp {fmtRp(totalBuku)}</b>
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <button type="button" className="btn btn-sm btn-navy" onClick={openAdd}>
            Tambah Aset
          </button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="table table-sm" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Tgl Perolehan</th>
              <th className="text-end">Harga Beli</th>
              <th className="text-end">Umur</th>
              <th className="text-end">Residu</th>
              <th className="text-end">Akum.Susut</th>
              <th className="text-end">Nilai Buku</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted py-3">
                  Belum ada aset tetap
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.no}</td>
                  <td className="fw-semibold">{r.nama}</td>
                  <td>
                    <span className="bd bd-blue">{r.kategori}</span>
                  </td>
                  <td style={{ fontSize: 10 }}>{r.tgl_perolehan}</td>
                  <td className="text-end mono">{fmtRp(r.harga_beli)}</td>
                  <td className="text-end">{r.umur_ekonomis}</td>
                  <td className="text-end mono">{fmtRp(r.nilai_residu)}</td>
                  <td className="text-end mono text-danger">{fmtRp(r.akum_calc)}</td>
                  <td className="text-end mono fw-bold text-success">{fmtRp(r.nilai_buku_calc)}</td>
                  <td className="no-print">
                    <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => openEdit(r)} title="Edit">
                      <i className="bi bi-pencil" />
                    </button>
                    <button type="button" className="btn btn-act btn-outline-warning" onClick={() => onDepresiasi(r)} title="Posting penyusutan">
                      <i className="bi bi-arrow-down" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Aset Tetap" size="lg">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-md-7">
                <label className="fl">Nama Aset *</label>
                <input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-5">
                <label className="fl">Kategori</label>
                <select value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))} className="form-select form-select-sm">
                  {KATEGORI.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="fl">Tgl Perolehan</label>
                <input type="date" value={form.tgl_perolehan} onChange={(e) => setForm((f) => ({ ...f, tgl_perolehan: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-4">
                <label className="fl">Harga Beli</label>
                <input type="number" value={form.harga_beli} onChange={(e) => setForm((f) => ({ ...f, harga_beli: e.target.value }))} className="form-control form-control-sm" required min={0} />
              </div>
              <div className="col-md-4">
                <label className="fl">Umur Ekonomis (th)</label>
                <input type="number" value={form.umur_ekonomis} onChange={(e) => setForm((f) => ({ ...f, umur_ekonomis: e.target.value }))} className="form-control form-control-sm" min={1} />
              </div>
              <div className="col-md-4">
                <label className="fl">Nilai Residu</label>
                <input type="number" value={form.nilai_residu} onChange={(e) => setForm((f) => ({ ...f, nilai_residu: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-4">
                <label className="fl">Metode</label>
                <select value={form.metode_susut} onChange={(e) => setForm((f) => ({ ...f, metode_susut: e.target.value }))} className="form-select form-select-sm">
                  <option value="garis-lurus">Garis Lurus</option>
                  <option value="saldo-menurun">Saldo Menurun</option>
                </select>
              </div>
              <div className="col-12">
                <label className="fl">Catatan</label>
                <textarea value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="form-control form-control-sm" rows={2} />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';

type Promo = {
  id: string;
  nama: string;
  tipe: string;
  nilai: number;
  barang_id?: string;
  barang_nama?: string;
  kategori: string;
  min_qty: number;
  min_total: number;
  member_only: number;
  tgl_mulai: string;
  tgl_akhir: string;
  status: string;
};

const EMPTY_FORM = {
  id: '',
  nama: '',
  tipe: 'persen',
  nilai: '',
  kategori: '',
  min_qty: '1',
  min_total: '0',
  member_only: false,
  tgl_mulai: '',
  tgl_akhir: '',
  status: 'aktif',
};

type FormType = typeof EMPTY_FORM;

export function PromoPageContent() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'danger'>('success');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<FormType>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: Promo[] }>('/promo')
      .then((r) => setRows(r.rows || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setShowEdit(true);
  }

  function openEdit(row: Promo) {
    setForm({
      id: row.id,
      nama: row.nama || '',
      tipe: row.tipe || 'persen',
      nilai: String(row.nilai || 0),
      kategori: row.kategori || '',
      min_qty: String(row.min_qty || 1),
      min_total: String(row.min_total || 0),
      member_only: !!row.member_only,
      tgl_mulai: row.tgl_mulai || '',
      tgl_akhir: row.tgl_akhir || '',
      status: row.status || 'aktif',
    });
    setShowEdit(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) {
      setFlash('Nama promo harus diisi');
      setFlashType('danger');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/promo/save', {
        id: form.id || undefined,
        nama: form.nama,
        tipe: form.tipe,
        nilai: Number(form.nilai) || 0,
        kategori: form.kategori || '',
        min_qty: Number(form.min_qty) || 1,
        min_total: Number(form.min_total) || 0,
        member_only: form.member_only ? 1 : 0,
        tgl_mulai: form.tgl_mulai || '',
        tgl_akhir: form.tgl_akhir || '',
        status: form.status,
      });
      setFlash(r.message || 'Promo tersimpan');
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

  async function onDelete(row: Promo) {
    if (!confirm(`Hapus promo "${row.nama}"?`)) return;
    try {
      const r = await api.delete<{ message?: string }>(`/promo/delete/${row.id}`);
      setFlash(r.message || 'Promo dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
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

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>🏷️ Promo & Diskon</h2>
          <p>{rows.length} promo · Kelola promo per item, kategori, atau member</p>
        </div>
        <div className="pg-hdr-right no-print">
          <button
            type="button"
            className="btn btn-sm btn-navy"
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={openAdd}
          >
            <i className="bi bi-plus-lg me-1" />
            Tambah Promo
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="table table-sm" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Tipe</th>
              <th className="text-end">Nilai</th>
              <th>Target</th>
              <th>Min Qty/Total</th>
              <th>Periode</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted py-3">
                  Belum ada promo
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.nama}</td>
                  <td>
                    <span className="bd bd-blue">{row.tipe}</span>
                  </td>
                  <td className="text-end mono fw-bold">
                    {row.nilai}
                    {row.tipe === 'persen' ? '%' : ''}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {row.barang_nama || row.kategori || 'Semua'}
                    {row.member_only ? (
                      <span className="bd bd-gray ms-1">Member only</span>
                    ) : null}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    Qty {row.min_qty} / Rp {fmtRp(row.min_total)}
                  </td>
                  <td style={{ fontSize: 10 }}>
                    {row.tgl_mulai} → {row.tgl_akhir}
                  </td>
                  <td>
                    <span className={`bd ${row.status === 'aktif' ? 'bd-green' : 'bd-gray'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="no-print">
                    <button
                      type="button"
                      className="btn btn-act btn-outline-primary"
                      onClick={() => openEdit(row)}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-act btn-outline-danger"
                      onClick={() => onDelete(row)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showEdit} title="Promo / Diskon" onClose={() => setShowEdit(false)}>
        <form onSubmit={onSave}>
          <div className="row g-2">
            <div className="col-12">
              <label className="fl">Nama Promo *</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="fl">Tipe</label>
              <select
                className="form-select form-select-sm"
                value={form.tipe}
                onChange={(e) => setForm({ ...form, tipe: e.target.value })}
              >
                <option value="persen">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="fl">Nilai *</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={form.nilai}
                onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                min="0"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="fl">Kategori (opsional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <label className="fl">Min Qty</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={form.min_qty}
                onChange={(e) => setForm({ ...form, min_qty: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <label className="fl">Min Total</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={form.min_total}
                onChange={(e) => setForm({ ...form, min_total: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="fl">Tgl Mulai</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={form.tgl_mulai}
                onChange={(e) => setForm({ ...form, tgl_mulai: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="fl">Tgl Akhir</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={form.tgl_akhir}
                onChange={(e) => setForm({ ...form, tgl_akhir: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="fl">Status</label>
              <select
                className="form-select form-select-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Non-aktif</option>
              </select>
            </div>
            <div className="col-12">
              <label>
                <input
                  type="checkbox"
                  checked={form.member_only}
                  onChange={(e) => setForm({ ...form, member_only: e.target.checked })}
                />{' '}
                Khusus member/anggota
              </label>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type CloseRow = {
  id: string;
  periode: string;
  tgl_tutup: string;
  user_name: string;
  catatan?: string;
};

export function PembukuanClosePeriodPageContent() {
  const [rows, setRows] = useState<CloseRow[]>([]);
  const [periode, setPeriode] = useState(today().slice(0, 7));
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: CloseRow[] }>('/pembukuan/close_period')
      .then((r) => setRows(r.rows || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onClose(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Tutup periode ini? Setelah ditutup tidak bisa diubah.')) return;
    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/pembukuan/close_period', { periode, catatan });
      setFlash(r.message || 'Periode ditutup');
      setFlashType('success');
      setCatatan('');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menutup periode');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {err && <Flash message={err} type="danger" />}
      {flash && <Flash message={flash} type={flashType} onClose={() => setFlash('')} />}
      <div className="mb-2 no-print">
        <Link href="/pembukuan" className="btn btn-sm btn-outline-secondary">
          ← Pembukuan
        </Link>
      </div>
      <div className="pg-hdr">
        <div className="pg-hdr-left">
            <h2>🔐 Tutup Buku</h2>
            <p>Periode tertutup mengunci jurnal dan transaksi yang memengaruhi SHU.</p>
        </div>
      </div>
      <div className="card mb-3" style={{ borderRadius: 8 }}>
        <div className="card-body p-3">
          <form onSubmit={onClose} className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="fl">Periode (YYYY-MM)</label>
              <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="form-control form-control-sm" required />
            </div>
            <div className="col-md-6">
              <label className="fl">Catatan</label>
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className="form-control form-control-sm" placeholder="Catatan tutup buku" />
            </div>
            <div className="col-md-3">
              <button type="submit" className="btn btn-sm btn-danger w-100" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Tutup Periode & Kunci SHU'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <h6>Periode yang Sudah Ditutup</h6>
      {loading ? (
        <div className="spinner-border spinner-border-sm" />
      ) : (
        <div className="tbl-wrap">
          <table className="table table-sm" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Tgl Tutup</th>
                <th>Oleh</th>
                <th>Catatan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-3">
                    Belum ada periode tertutup
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-bold">{r.periode}</td>
                    <td>{r.tgl_tutup}</td>
                    <td>{r.user_name}</td>
                    <td style={{ fontSize: 10, color: '#64748B' }}>{r.catatan}</td>
                    <td>
                      <span className="bd bd-red">closed</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

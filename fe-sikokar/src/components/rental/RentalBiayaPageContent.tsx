'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type BiayaRow = {
  id: string;
  tgl: string;
  kendaraan_nama?: string;
  jenis: string;
  deskripsi?: string;
  nominal: number;
};

type KendaraanOpt = { id: string; nama: string; no_polisi?: string };
type Summary = { jenis: string; total: number };

const JENIS_BIAYA = ['BBM', 'Tol', 'Parkir', 'Driver', 'Cuci', 'Lain'];

export function RentalBiayaPageContent() {
  const [rows, setRows] = useState<BiayaRow[]>([]);
  const [kendaraan, setKendaraan] = useState<KendaraanOpt[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    kendaraan_id: '',
    tgl: today(),
    jenis: 'BBM',
    deskripsi: '',
    nominal: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: BiayaRow[]; kendaraan: KendaraanOpt[]; summary: Summary[] }>('/rental/biaya')
      .then((r) => {
        setRows(r.rows || []);
        setKendaraan(r.kendaraan || []);
        setSummary(r.summary || []);
        setForm((f) => ({
          ...f,
          kendaraan_id: f.kendaraan_id || r.kendaraan?.[0]?.id || '',
        }));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/rental/biaya', {
        ...form,
        nominal: Number(form.nominal) || 0,
      });
      setFlash(r.message || 'Biaya operasional disimpan');
      setFlashType('success');
      setForm((f) => ({ ...f, deskripsi: '', nominal: '', tgl: today() }));
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
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
          <h2>⛽ Biaya Operasional</h2>
          <p>BBM, tol, parkir, driver, dll</p>
        </div>
      </div>

      {summary.length > 0 && (
        <div className="row g-2 mb-3">
          {summary.map((s) => (
            <div className="col-md-2" key={s.jenis}>
              <div className="stat-card" style={{ borderLeft: '3px solid #DC2626' }}>
                <div className="stat-val" style={{ fontSize: 13 }}>
                  Rp {fmtRp(s.total)}
                </div>
                <div className="stat-label">{s.jenis} bulan ini</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-3">
        <div className="card-body p-3">
          <form onSubmit={onSubmit} className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="fl">Tanggal</label>
              <input type="date" value={form.tgl} onChange={(e) => setForm((f) => ({ ...f, tgl: e.target.value }))} className="form-control form-control-sm" />
            </div>
            <div className="col-md-3">
              <label className="fl">Kendaraan</label>
              <select
                value={form.kendaraan_id}
                onChange={(e) => setForm((f) => ({ ...f, kendaraan_id: e.target.value }))}
                className="form-select form-select-sm"
                required
              >
                {kendaraan.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                    {k.no_polisi ? ` (${k.no_polisi})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="fl">Jenis</label>
              <select value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))} className="form-select form-select-sm">
                {JENIS_BIAYA.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="fl">Deskripsi</label>
              <input value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} className="form-control form-control-sm" />
            </div>
            <div className="col-md-2">
              <label className="fl">Nominal (Rp)</label>
              <input
                type="number"
                value={form.nominal}
                onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))}
                className="form-control form-control-sm"
                required
                min={0}
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-sm btn-navy" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Tambah Biaya'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="table table-sm" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Tgl</th>
              <th>Kendaraan</th>
              <th>Jenis</th>
              <th>Deskripsi</th>
              <th className="text-end">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted py-3">
                  Belum ada biaya operasional
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.tgl}</td>
                  <td className="fw-semibold">{r.kendaraan_nama}</td>
                  <td>
                    <span className="bd bd-amber">{r.jenis}</span>
                  </td>
                  <td>{r.deskripsi}</td>
                  <td className="text-end mono">{fmtRp(r.nominal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

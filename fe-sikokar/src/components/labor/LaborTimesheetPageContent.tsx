'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type Pekerja = {
  id: string;
  nama: string;
  jabatan: string;
};

type TimesheetRow = {
  id: string;
  tgl: string;
  status: string;
  jam_masuk: string;
  jam_keluar: string;
  jam_kerja: number;
  jam_lembur: number;
  keterangan: string;
};

type Summary = {
  total_hari: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  total_jam: number;
  total_lembur: number;
};

const STATUS_COLORS: Record<string, string> = {
  hadir: 'success',
  izin: 'info',
  sakit: 'warning',
  alpha: 'danger',
  cuti: 'secondary',
};

export function LaborTimesheetPageContent() {
  const params = useParams();
  const pekerja_id = String(params.pekerja_id || '');

  const [pekerja, setPekerja] = useState<Pekerja | null>(null);
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_hari: 0,
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpha: 0,
    total_jam: 0,
    total_lembur: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tgl: today(),
    status: 'hadir',
    jam_masuk: '08:00',
    jam_keluar: '17:00',
    jam_kerja: '8',
    jam_lembur: '0',
    keterangan: '',
  });

  const load = () => {
    setLoading(true);
    setErr('');
    api
      .get<{ pekerja: Pekerja; rows: TimesheetRow[]; summary: Summary }>(
        `/labor/timesheet/${pekerja_id}`,
      )
      .then((r) => {
        setPekerja(r.pekerja || null);
        setRows(r.rows || []);
        setSummary(r.summary || { total_hari: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, total_jam: 0, total_lembur: 0 });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pekerja_id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>(`/labor/timesheet/${pekerja_id}`, {
        ...form,
        jam_kerja: Number(form.jam_kerja) || 0,
        jam_lembur: Number(form.jam_lembur) || 0,
      });
      setFlash(r.message || 'Timesheet disimpan');
      setForm({ ...form, keterangan: '' });
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (err || !pekerja) {
    return (
      <>
        <Flash message={err || 'Pekerja tidak ditemukan'} type="danger" />
        <Link href="/labor" className="btn btn-sm btn-secondary">
          ← Kembali
        </Link>
      </>
    );
  }

  return (
    <>
      {flash && <Flash message={flash} type="success" onClose={() => setFlash('')} />}

      <div className="pg-hdr mb-3">
        <div className="pg-hdr-left">
          <h2>⏱️ Timesheet: {pekerja.nama}</h2>
          <p>
            {pekerja.jabatan} · Bulan ini: <b>{summary.hadir}/{summary.total_hari} hari hadir</b> · Total jam:{' '}
            {summary.total_jam} (Lembur: {summary.total_lembur})
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <Link href="/labor" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6 }}>
            ← Kembali
          </Link>
        </div>
      </div>

      <div className="row g-2 mb-3">
        {[
          { label: 'Hadir', val: summary.hadir, color: '#16A34A' },
          { label: 'Izin', val: summary.izin, color: '#0EA5E9' },
          { label: 'Sakit', val: summary.sakit, color: '#D97706' },
          { label: 'Alpha', val: summary.alpha, color: '#DC2626' },
          { label: 'Jam Kerja', val: summary.total_jam, color: '#0F2744' },
          { label: 'Jam Lembur', val: summary.total_lembur, color: '#0F2744' },
        ].map((s) => (
          <div className="col-md-2 col-4" key={s.label}>
            <div className="stat-card text-center p-2 border rounded">
              <div style={{ fontWeight: 700, fontSize: 18, color: s.color }}>{s.val}</div>
              <div className="small text-muted">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-3">
        <div className="card-body p-3">
          <form onSubmit={onSubmit} className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label">Tanggal</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={form.tgl}
                onChange={(e) => setForm({ ...form, tgl: e.target.value })}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select
                className="form-select form-select-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="hadir">Hadir</option>
                <option value="izin">Izin</option>
                <option value="sakit">Sakit</option>
                <option value="alpha">Alpha</option>
                <option value="cuti">Cuti</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Jam Masuk</label>
              <input
                type="time"
                className="form-control form-control-sm"
                value={form.jam_masuk}
                onChange={(e) => setForm({ ...form, jam_masuk: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Jam Keluar</label>
              <input
                type="time"
                className="form-control form-control-sm"
                value={form.jam_keluar}
                onChange={(e) => setForm({ ...form, jam_keluar: e.target.value })}
              />
            </div>
            <div className="col-md-1">
              <label className="form-label">Jam Kerja</label>
              <input
                type="number"
                step="0.5"
                className="form-control form-control-sm"
                value={form.jam_kerja}
                onChange={(e) => setForm({ ...form, jam_kerja: e.target.value })}
              />
            </div>
            <div className="col-md-1">
              <label className="form-label">Lembur</label>
              <input
                type="number"
                step="0.5"
                className="form-control form-control-sm"
                value={form.jam_lembur}
                onChange={(e) => setForm({ ...form, jam_lembur: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Keterangan</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-sm btn-navy" disabled={saving}>
                {saving ? 'Menyimpan...' : '+ Tambah Absensi'}
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
              <th>Status</th>
              <th>Masuk</th>
              <th>Keluar</th>
              <th className="text-end">Jam Kerja</th>
              <th className="text-end">Lembur</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-3">
                  Belum ada absensi
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.tgl}</td>
                  <td>
                    <span className={`badge bg-${STATUS_COLORS[r.status] || 'secondary'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.jam_masuk}</td>
                  <td>{r.jam_keluar}</td>
                  <td className="text-end mono">{r.jam_kerja}</td>
                  <td className="text-end mono fw-bold">{r.jam_lembur}</td>
                  <td style={{ fontSize: 10, color: '#64748B' }}>{r.keterangan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

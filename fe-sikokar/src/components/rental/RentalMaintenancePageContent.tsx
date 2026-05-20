'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type MaintRow = {
  id: string;
  kendaraan_id: string;
  kendaraan_nama?: string;
  tgl: string;
  jenis: string;
  deskripsi?: string;
  biaya: number;
  km_saat_ini?: number;
  next_service_km?: number;
  next_service_tgl?: string;
  bengkel?: string;
  catatan?: string;
  biaya_fuel?: number;
  biaya_tol?: number;
  biaya_konsumsi?: number;
  liter_fuel?: number;
};

type KendaraanOpt = { id: string; nama: string; no_polisi?: string };
type JenisOpt = { value: string; label: string };

const btnStyle = { borderRadius: 6, fontSize: 12 };

const EMPTY = {
  id: '',
  kendaraan_id: '',
  tgl: today(),
  jenis: '',
  deskripsi: '',
  biaya: '0',
  biaya_fuel: '0',
  biaya_tol: '0',
  biaya_konsumsi: '0',
  liter_fuel: '0',
  km_saat_ini: '0',
  next_service_km: '0',
  next_service_tgl: '',
  bengkel: '',
  catatan: '',
};

export function RentalMaintenancePageContent() {
  const [rows, setRows] = useState<MaintRow[]>([]);
  const [kendaraan, setKendaraan] = useState<KendaraanOpt[]>([]);
  const [upcoming, setUpcoming] = useState<MaintRow[]>([]);
  const [jenisOptions, setJenisOptions] = useState<JenisOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [jenisSel, setJenisSel] = useState('');
  const [jenisCustom, setJenisCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  const rowsMap = useMemo(() => {
    const m: Record<string, MaintRow> = {};
    rows.forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [rows]);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: MaintRow[]; kendaraan: KendaraanOpt[]; upcoming: MaintRow[]; jenis_options: JenisOpt[] }>(
        '/rental/maintenance',
      )
      .then((r) => {
        setRows(r.rows || []);
        setKendaraan(r.kendaraan || []);
        setUpcoming(r.upcoming || []);
        setJenisOptions(r.jenis_options || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm({ ...EMPTY, tgl: today(), kendaraan_id: kendaraan[0]?.id || '' });
    setJenisSel('');
    setJenisCustom(false);
  }

  function openAdd() {
    resetForm();
    setShowEdit(true);
  }

  function openEdit(row: MaintRow) {
    const opts = jenisOptions.map((o) => o.value);
    setForm({
      id: row.id,
      kendaraan_id: row.kendaraan_id,
      tgl: row.tgl,
      jenis: row.jenis || '',
      deskripsi: row.deskripsi || '',
      biaya: String(row.biaya || 0),
      biaya_fuel: String(row.biaya_fuel || 0),
      biaya_tol: String(row.biaya_tol || 0),
      biaya_konsumsi: String(row.biaya_konsumsi || 0),
      liter_fuel: String(row.liter_fuel || 0),
      km_saat_ini: String(row.km_saat_ini || 0),
      next_service_km: String(row.next_service_km || 0),
      next_service_tgl: row.next_service_tgl || '',
      bengkel: row.bengkel || '',
      catatan: row.catatan || '',
    });
    if (row.jenis && opts.includes(row.jenis)) {
      setJenisSel(row.jenis);
      setJenisCustom(false);
    } else if (row.jenis) {
      setJenisSel('__tambah__');
      setJenisCustom(true);
    }
    setShowEdit(true);
  }

  function onJenisChange(val: string) {
    setJenisSel(val);
    if (val === '__tambah__') {
      setJenisCustom(true);
      setForm((f) => ({ ...f, jenis: '' }));
    } else {
      setJenisCustom(false);
      setForm((f) => ({ ...f, jenis: val }));
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/rental/maintenance', form);
      setFlash(r.message || 'Data maintenance disimpan');
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

  async function onDelete(id: string) {
    if (!confirm('Hapus data maintenance?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/rental/maintenance/delete/${id}`);
      setFlash(r.message || 'Data dihapus');
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
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.maintenance_custom} size={24} style={{ marginRight: 8 }} />
            Maintenance Kendaraan
          </h2>
          <p>{rows.length} catatan · Service, ganti oli, tune-up</p>
        </div>
        <div className="pg-hdr-right no-print">
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openAdd}>
            Tambah
          </button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="alert alert-warning" style={{ fontSize: 13 }}>
          <b>⚠️ Service mendatang (30 hari):</b>{' '}
          {upcoming.map((u) => (
            <span key={u.id} className="badge bg-warning text-dark me-1">
              {u.kendaraan_nama} → {u.next_service_tgl} ({u.jenis})
            </span>
          ))}
        </div>
      )}

      <div className="tbl-wrap">
        <table className="table table-sm" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Tgl</th>
              <th>Kendaraan</th>
              <th>Jenis</th>
              <th>Deskripsi</th>
              <th className="text-end">Biaya</th>
              <th>KM</th>
              <th>Next Service</th>
              <th>Bengkel</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted py-3">
                  Belum ada catatan maintenance
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 10 }}>{r.tgl}</td>
                  <td className="fw-semibold">{r.kendaraan_nama}</td>
                  <td>
                    <span className="bd bd-blue">{r.jenis}</span>
                  </td>
                  <td>{r.deskripsi}</td>
                  <td className="text-end mono">{fmtRp(r.biaya)}</td>
                  <td className="text-end mono">{r.km_saat_ini}</td>
                  <td style={{ fontSize: 10 }}>
                    {r.next_service_tgl} / {r.next_service_km} km
                  </td>
                  <td style={{ fontSize: 10, color: '#64748B' }}>{r.bengkel}</td>
                  <td>
                    <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => openEdit(rowsMap[r.id] || r)}>
                      ✎
                    </button>
                    <button type="button" className="btn btn-act btn-outline-danger" onClick={() => onDelete(r.id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Maintenance Kendaraan" size="lg">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-md-5">
                <label className="fl">Kendaraan *</label>
                <select
                  value={form.kendaraan_id}
                  onChange={(e) => setForm((f) => ({ ...f, kendaraan_id: e.target.value }))}
                  className="form-select form-select-sm"
                  required
                >
                  {kendaraan.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} {k.no_polisi ? `(${k.no_polisi})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="fl">Tanggal</label>
                <input type="date" value={form.tgl} onChange={(e) => setForm((f) => ({ ...f, tgl: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-4">
                <label className="fl">Jenis</label>
                <select value={jenisSel} onChange={(e) => onJenisChange(e.target.value)} className="form-select form-select-sm">
                  <option value="">— Pilih Jenis —</option>
                  {jenisOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value="__tambah__">➕ Tambah Jenis Baru...</option>
                </select>
                {jenisCustom && (
                  <input
                    value={form.jenis}
                    onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))}
                    className="form-control form-control-sm mt-1"
                    placeholder="Ketik jenis baru..."
                  />
                )}
              </div>
              <div className="col-12">
                <label className="fl">Deskripsi</label>
                <input value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Biaya Service</label>
                <input type="number" value={form.biaya} onChange={(e) => setForm((f) => ({ ...f, biaya: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Biaya Fuel</label>
                <input type="number" value={form.biaya_fuel} onChange={(e) => setForm((f) => ({ ...f, biaya_fuel: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Biaya Tol</label>
                <input type="number" value={form.biaya_tol} onChange={(e) => setForm((f) => ({ ...f, biaya_tol: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Biaya Konsumsi</label>
                <input type="number" value={form.biaya_konsumsi} onChange={(e) => setForm((f) => ({ ...f, biaya_konsumsi: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Liter Fuel</label>
                <input type="number" step="0.01" value={form.liter_fuel} onChange={(e) => setForm((f) => ({ ...f, liter_fuel: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">KM saat ini</label>
                <input type="number" value={form.km_saat_ini} onChange={(e) => setForm((f) => ({ ...f, km_saat_ini: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Next Service KM</label>
                <input type="number" value={form.next_service_km} onChange={(e) => setForm((f) => ({ ...f, next_service_km: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Next Service Tgl</label>
                <input type="date" value={form.next_service_tgl} onChange={(e) => setForm((f) => ({ ...f, next_service_tgl: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-6">
                <label className="fl">Bengkel</label>
                <input value={form.bengkel} onChange={(e) => setForm((f) => ({ ...f, bengkel: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-12">
                <label className="fl">Catatan</label>
                <input value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="form-control form-control-sm" />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}

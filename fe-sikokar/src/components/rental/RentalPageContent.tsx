'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';

type Aset = {
  id: string;
  kode: string;
  no_pol?: string;
  nama: string;
  jenis: string;
  tarif_harian: number;
  tarif_bulanan: number;
  status: string;
  kapasitas?: number;
};

type RentalRow = {
  id: string;
  no: string;
  tgl_mulai: string;
  tgl_selesai: string;
  aset_nama?: string;
  aset_kode?: string;
  nama_penyewa: string;
  nama_perusahaan?: string;
  tipe_harga: string;
  hari: number;
  total: number;
  status: string;
};

const JENIS_ASET_SUGGEST = [
  'Kendaraan Roda 4',
  'Kendaraan Roda 6',
  'Kendaraan Roda 2',
  'Minibus',
  'Bus',
  'Pick-up',
  'Truck',
  'Forklift',
  'Reach Stacker',
  'Container 20ft',
  'Container 40ft',
  'Office Container',
  'Genset',
  'Crane',
  'Excavator',
  'Peralatan Lain',
];

const btnStyle = { borderRadius: 6, fontSize: 12 };

function assetIcon(jenis: string) {
  const j = jenis.toLowerCase();
  if (j.includes('forklift')) return '🏗️';
  if (j.includes('container')) return '📦';
  if (j.includes('minibus') || j.includes('bus')) return '🚌';
  if (j.includes('pick') || j.includes('truck')) return '🚚';
  if (j.includes('sedan')) return '🚗';
  if (j.includes('sepeda') || j.includes('motor') || j.includes('roda 2')) return '🏍️';
  return '⚙️';
}

function calcRentalTotal(
  aset: Aset | undefined,
  tglMulai: string,
  tglSelesai: string,
  tipe: string,
  tarifCustom: number,
) {
  if (!aset || !tglMulai || !tglSelesai) return null;
  const d1 = new Date(tglMulai);
  const d2 = new Date(tglSelesai);
  const hari = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  const bulan = Math.max(1, Math.round(hari / 30));
  let total = 0;
  if (tipe === 'custom') total = tarifCustom;
  else if (tipe === 'bulanan') total = (Number(aset.tarif_bulanan) || 0) * bulan;
  else total = (Number(aset.tarif_harian) || 0) * hari;
  return { hari, total };
}

export function RentalPageContent() {
  const [rows, setRows] = useState<RentalRow[]>([]);
  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [jenisList, setJenisList] = useState<{ jenis: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [tgl, setTgl] = useState('');
  const [kategori, setKategori] = useState('');
  const [q, setQ] = useState('');
  const [filterTgl, setFilterTgl] = useState('');
  const [filterKat, setFilterKat] = useState('');
  const [filterQ, setFilterQ] = useState('');

  const [showBooking, setShowBooking] = useState(false);
  const [showAset, setShowAset] = useState(false);
  const [showKembali, setShowKembali] = useState(false);
  const [kembaliId, setKembaliId] = useState('');
  const [saving, setSaving] = useState(false);

  const [booking, setBooking] = useState({
    kendaraan_id: '',
    tgl_mulai: today(),
    tgl_selesai: today(),
    tipe_harga: 'harian',
    tarif_custom: '',
    penyewa_tipe: 'umum',
    nama_penyewa: '',
    nama_perusahaan: '',
    no_hp: '',
    keperluan: '',
  });

  const [kembaliForm, setKembaliForm] = useState({ km_kembali: '', kondisi: 'baik', denda: '0' });

  const [asetForm, setAsetForm] = useState({
    id: '',
    kode: '',
    nama: '',
    jenis: '',
    no_pol: '',
    tarif_harian: '0',
    tarif_bulanan: '0',
    kapasitas: '1',
    status: 'tersedia',
  });
  const [asetFormTitle, setAsetFormTitle] = useState('Tambah Aset Baru');

  const asetMap = useMemo(() => {
    const m: Record<string, Aset> = {};
    asetList.forEach((a) => {
      m[a.id] = a;
    });
    return m;
  }, [asetList]);

  const selectedAset = booking.kendaraan_id ? asetMap[booking.kendaraan_id] : undefined;
  const estTotal = calcRentalTotal(
    selectedAset,
    booking.tgl_mulai,
    booking.tgl_selesai,
    booking.tipe_harga,
    Number(booking.tarif_custom) || 0,
  );

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams();
    if (filterTgl) params.set('tgl', filterTgl);
    if (filterKat) params.set('kategori', filterKat);
    if (filterQ) params.set('q', filterQ);
    const qs = params.toString() ? `?${params}` : '';
    api
      .get<{ rows: RentalRow[]; aset_list: Aset[]; jenis_list: { jenis: string }[] }>(`/rental${qs}`)
      .then((r) => {
        setRows(r.rows || []);
        setAsetList(r.aset_list || []);
        setJenisList(r.jenis_list || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterTgl, filterKat, filterQ]);

  useEffect(() => {
    load();
  }, [load]);

  function resetBooking() {
    setBooking({
      kendaraan_id: '',
      tgl_mulai: today(),
      tgl_selesai: today(),
      tipe_harga: 'harian',
      tarif_custom: '',
      penyewa_tipe: 'umum',
      nama_penyewa: '',
      nama_perusahaan: '',
      no_hp: '',
      keperluan: '',
    });
  }

  function resetAsetForm() {
    setAsetForm({
      id: '',
      kode: '',
      nama: '',
      jenis: '',
      no_pol: '',
      tarif_harian: '0',
      tarif_bulanan: '0',
      kapasitas: '1',
      status: 'tersedia',
    });
    setAsetFormTitle('Tambah Aset Baru');
  }

  function editAset(a: Aset) {
    setAsetForm({
      id: a.id,
      kode: a.kode || '',
      nama: a.nama || '',
      jenis: a.jenis || '',
      no_pol: a.no_pol || '',
      tarif_harian: String(a.tarif_harian || 0),
      tarif_bulanan: String(a.tarif_bulanan || 0),
      kapasitas: String(a.kapasitas || 1),
      status: a.status || 'tersedia',
    });
    setAsetFormTitle(`Edit Aset: ${a.nama}`);
  }

  async function onBooking(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const r = await api.post<{ message?: string }>('/rental/booking', {
        ...booking,
        tarif_custom: Number(booking.tarif_custom) || 0,
      });
      setFlash(r.message || 'Booking berhasil');
      setFlashType('success');
      setShowBooking(false);
      resetBooking();
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal booking');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function onKembali(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>(`/rental/kembali/${kembaliId}`, {
        km_kembali: Number(kembaliForm.km_kembali) || undefined,
        kondisi: kembaliForm.kondisi,
        denda: Number(kembaliForm.denda) || 0,
      });
      setFlash(r.message || 'Aset dikembalikan');
      setFlashType('success');
      setShowKembali(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function onAsetSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/rental/aset/save', {
        ...asetForm,
        tarif_harian: Number(asetForm.tarif_harian) || 0,
        tarif_bulanan: Number(asetForm.tarif_bulanan) || 0,
        kapasitas: Number(asetForm.kapasitas) || 1,
      });
      setFlash(r.message || 'Aset tersimpan');
      setFlashType('success');
      resetAsetForm();
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan aset');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function onAsetDelete(id: string) {
    if (!confirm('Hapus aset?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/rental/aset/delete/${id}`);
      setFlash(r.message || 'Aset dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  if (loading && !rows.length && !asetList.length && !err) {
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
          <h2>🚗 Rental Aset</h2>
          <p>Kendaraan & Peralatan · {rows.length} transaksi</p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl('/rental/export?fmt=xlsx')} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">
            Excel
          </a>
          <a href={api.exportUrl('/rental/export?fmt=csv')} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">
            CSV
          </a>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
            Print
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-info"
            style={btnStyle}
            onClick={() => {
              resetAsetForm();
              setShowAset(true);
            }}
          >
            Kelola Aset
          </button>
          <button
            type="button"
            className="btn btn-sm btn-navy"
            style={btnStyle}
            onClick={() => {
              resetBooking();
              setShowBooking(true);
            }}
          >
            Booking
          </button>
        </div>
      </div>

      <form
        className="toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          setFilterTgl(tgl);
          setFilterKat(kategori);
          setFilterQ(q);
        }}
      >
        <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
        <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="form-select form-select-sm" style={{ width: 160, borderRadius: 6 }}>
          <option value="">Semua Kategori</option>
          {jenisList.map((j) => (
            <option key={j.jenis} value={j.jenis}>
              {j.jenis}
            </option>
          ))}
        </select>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="No / Penyewa..." className="form-control form-control-sm" style={{ width: 180, borderRadius: 6 }} />
        <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>
          Cari
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          style={{ borderRadius: 6 }}
          onClick={() => {
            setTgl('');
            setKategori('');
            setQ('');
            setFilterTgl('');
            setFilterKat('');
            setFilterQ('');
          }}
        >
          Reset
        </button>
      </form>

      <div className="row g-2 mb-3 no-print" style={{ overflowX: 'auto', flexWrap: 'nowrap', display: 'flex' }}>
        {asetList.map((a) => (
          <div className="col-auto" key={a.id}>
            <div className="stat-card p-2" style={{ minWidth: 140 }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{assetIcon(a.jenis)}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{a.nama}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>
                {a.kode} · {a.jenis}
              </div>
              <span className={`bd ${a.status === 'tersedia' ? 'bd-green' : a.status === 'disewa' ? 'bd-amber' : 'bd-red'}`} style={{ marginTop: 4 }}>
                {a.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>No Rental</th>
              <th>Tgl Mulai</th>
              <th>Tgl Selesai</th>
              <th>Aset</th>
              <th>Kategori</th>
              <th>Penyewa</th>
              <th>Tipe Harga</th>
              <th className="text-end">Total</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted py-4">
                  Belum ada data rental
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono fw-semibold" style={{ fontSize: 11 }}>
                      {r.no}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.tgl_mulai}</td>
                  <td style={{ fontSize: 11 }}>{r.tgl_selesai}</td>
                  <td className="fw-semibold">{r.aset_nama}</td>
                  <td>
                    <span className="bd bd-navy" style={{ fontSize: 10 }}>
                      {r.aset_kode}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {r.nama_penyewa}
                    {r.nama_perusahaan && (
                      <>
                        <br />
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>{r.nama_perusahaan}</span>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    <span className="bd bd-gray">{r.tipe_harga}</span> {r.hari} hr
                  </td>
                  <td className="text-end mono fw-bold">{fmtRp(r.total)}</td>
                  <td>
                    <span className={`bd ${r.status === 'selesai' ? 'bd-green' : r.status === 'aktif' ? 'bd-amber' : 'bd-gray'}`}>{r.status}</span>
                  </td>
                  <td className="no-print">
                    {r.status === 'aktif' && (
                      <button
                        type="button"
                        className="btn btn-act btn-outline-success"
                        onClick={() => {
                          setKembaliId(r.id);
                          setKembaliForm({ km_kembali: '', kondisi: 'baik', denda: '0' });
                          setShowKembali(true);
                        }}
                      >
                        Kembali
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showBooking} onClose={() => setShowBooking(false)} title="Booking Rental Aset" size="lg">
        <form onSubmit={onBooking}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-12">
                <label className="fl">Pilih Aset *</label>
                <select
                  value={booking.kendaraan_id}
                  onChange={(e) => setBooking((b) => ({ ...b, kendaraan_id: e.target.value }))}
                  className="form-select form-select-sm"
                  required
                >
                  <option value="">— Pilih Aset —</option>
                  {asetList.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.jenis}] {a.nama} ({a.kode}) — Status: {a.status}
                    </option>
                  ))}
                </select>
                {selectedAset && selectedAset.status !== 'tersedia' && (
                  <div className="mt-1 p-1 rounded" style={{ background: '#FEF3C7', fontSize: 11, color: '#92400E' }}>
                    ⚠️ Aset ini sedang disewa
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <label className="fl">Tgl Mulai *</label>
                <input type="date" value={booking.tgl_mulai} onChange={(e) => setBooking((b) => ({ ...b, tgl_mulai: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-6">
                <label className="fl">Tgl Selesai *</label>
                <input type="date" value={booking.tgl_selesai} onChange={(e) => setBooking((b) => ({ ...b, tgl_selesai: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-4">
                <label className="fl">Tipe Harga</label>
                <select value={booking.tipe_harga} onChange={(e) => setBooking((b) => ({ ...b, tipe_harga: e.target.value }))} className="form-select form-select-sm">
                  <option value="harian">Harian</option>
                  <option value="bulanan">Bulanan</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="fl">Tarif Custom (Rp)</label>
                <input type="number" value={booking.tarif_custom} onChange={(e) => setBooking((b) => ({ ...b, tarif_custom: e.target.value }))} className="form-control form-control-sm" placeholder="Jika custom" />
              </div>
              <div className="col-md-4">
                <label className="fl">Estimasi Total</label>
                <div className="p-2 rounded fw-bold" style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: 14, minHeight: 32 }}>
                  {estTotal ? `Rp ${fmtRp(estTotal.total)} (${estTotal.hari} hari)` : '—'}
                </div>
              </div>
              <div className="col-md-4">
                <label className="fl">Tipe Penyewa</label>
                <select value={booking.penyewa_tipe} onChange={(e) => setBooking((b) => ({ ...b, penyewa_tipe: e.target.value }))} className="form-select form-select-sm">
                  <option value="umum">Umum</option>
                  <option value="karyawan">Karyawan/Anggota</option>
                  <option value="perusahaan">Perusahaan</option>
                </select>
              </div>
              <div className="col-md-8">
                <label className="fl">Nama Penyewa *</label>
                <input value={booking.nama_penyewa} onChange={(e) => setBooking((b) => ({ ...b, nama_penyewa: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-6">
                <label className="fl">Nama Perusahaan</label>
                <input value={booking.nama_perusahaan} onChange={(e) => setBooking((b) => ({ ...b, nama_perusahaan: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-6">
                <label className="fl">No HP</label>
                <input value={booking.no_hp} onChange={(e) => setBooking((b) => ({ ...b, no_hp: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-12">
                <label className="fl">Keperluan</label>
                <input value={booking.keperluan} onChange={(e) => setBooking((b) => ({ ...b, keperluan: e.target.value }))} className="form-control form-control-sm" />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowBooking(false)} saving={saving} submitLabel="Buat Booking" />
        </form>
      </Modal>

      <Modal open={showKembali} onClose={() => setShowKembali(false)} title="Pengembalian Aset" size="md">
        <form onSubmit={onKembali}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-md-6">
                <label className="fl">KM Kembali</label>
                <input type="number" value={kembaliForm.km_kembali} onChange={(e) => setKembaliForm((f) => ({ ...f, km_kembali: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-6">
                <label className="fl">Kondisi</label>
                <select value={kembaliForm.kondisi} onChange={(e) => setKembaliForm((f) => ({ ...f, kondisi: e.target.value }))} className="form-select form-select-sm">
                  <option value="baik">Baik</option>
                  <option value="ada kerusakan">Ada Kerusakan</option>
                  <option value="perlu servis">Perlu Servis</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Denda (Rp)</label>
                <input type="number" value={kembaliForm.denda} onChange={(e) => setKembaliForm((f) => ({ ...f, denda: e.target.value }))} className="form-control form-control-sm" />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowKembali(false)} saving={saving} submitLabel="Konfirmasi Kembali" />
        </form>
      </Modal>

      <Modal open={showAset} onClose={() => setShowAset(false)} title="Kelola Aset Rental" size="lg">
        <div className="modal-body">
          <div className="tbl-wrap mb-3">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Jenis</th>
                  <th className="text-end">Tarif/Hari</th>
                  <th className="text-end">Tarif/Bln</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {asetList.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="mono">{a.kode}</span>
                    </td>
                    <td className="fw-semibold">{a.nama}</td>
                    <td>
                      <span className="bd bd-navy" style={{ fontSize: 10 }}>
                        {a.jenis}
                      </span>
                    </td>
                    <td className="text-end mono">{fmtRp(a.tarif_harian)}</td>
                    <td className="text-end mono">{fmtRp(a.tarif_bulanan)}</td>
                    <td>
                      <span className={`bd ${a.status === 'tersedia' ? 'bd-green' : 'bd-amber'}`}>{a.status}</span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => editAset(a)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button type="button" className="btn btn-act btn-outline-danger" onClick={() => onAsetDelete(a.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <hr />
          <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{asetFormTitle}</h6>
          <form onSubmit={onAsetSave}>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="fl">Kode</label>
                <input value={asetForm.kode} onChange={(e) => setAsetForm((f) => ({ ...f, kode: e.target.value }))} className="form-control form-control-sm" placeholder="AST-001" />
              </div>
              <div className="col-md-5">
                <label className="fl">Nama Aset *</label>
                <input value={asetForm.nama} onChange={(e) => setAsetForm((f) => ({ ...f, nama: e.target.value }))} className="form-control form-control-sm" required />
              </div>
              <div className="col-md-4">
                <label className="fl">Kategori / Jenis *</label>
                <input value={asetForm.jenis} onChange={(e) => setAsetForm((f) => ({ ...f, jenis: e.target.value }))} className="form-control form-control-sm" required list="jenis-aset-list" />
                <datalist id="jenis-aset-list">
                  {JENIS_ASET_SUGGEST.map((j) => (
                    <option key={j} value={j} />
                  ))}
                </datalist>
              </div>
              <div className="col-md-3">
                <label className="fl">Tarif Harian</label>
                <input type="number" value={asetForm.tarif_harian} onChange={(e) => setAsetForm((f) => ({ ...f, tarif_harian: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Tarif Bulanan</label>
                <input type="number" value={asetForm.tarif_bulanan} onChange={(e) => setAsetForm((f) => ({ ...f, tarif_bulanan: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Kapasitas</label>
                <input type="number" value={asetForm.kapasitas} onChange={(e) => setAsetForm((f) => ({ ...f, kapasitas: e.target.value }))} className="form-control form-control-sm" min={1} />
              </div>
              <div className="col-md-3">
                <label className="fl">No. Pol / ID</label>
                <input value={asetForm.no_pol} onChange={(e) => setAsetForm((f) => ({ ...f, no_pol: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-3">
                <label className="fl">Status</label>
                <select value={asetForm.status} onChange={(e) => setAsetForm((f) => ({ ...f, status: e.target.value }))} className="form-select form-select-sm">
                  <option value="tersedia">Tersedia</option>
                  <option value="disewa">Disewa</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-sm btn-navy" disabled={saving}>
                  Simpan Aset
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary ms-1" onClick={resetAsetForm}>
                  Reset Form
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

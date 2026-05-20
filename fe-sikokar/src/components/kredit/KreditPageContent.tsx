'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type KreditRow = {
  id: string;
  no: string;
  anggota_id: string;
  anggota_nama: string;
  nip?: string;
  jenis: string;
  nama_barang?: string;
  toko?: string;
  harga_beli: number;
  dp: number;
  pokok: number;
  bunga_pct: number;
  tenor: number;
  angsuran: number;
  sisa_pokok: number;
  cicilan_ke: number;
  status: string;
  tgl_mulai?: string;
  catatan?: string;
};

type AnggotaOpt = { id: string; no: string; nama: string };
type JenisOpt = { value: string; label: string };

const btnStyle = { borderRadius: 6, fontSize: 12 };

const METODE_OPTS = [
  { value: 'potong-gaji', label: 'Potong Gaji' },
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
];

function calcKreditPreview(harga: number, dp: number, bunga: number, tenor: number) {
  const pokok = Math.max(0, harga - dp);
  const totalBunga = (pokok * bunga) / 100 * tenor;
  const totalBayar = pokok + totalBunga;
  const angs = tenor > 0 ? Math.round(totalBayar / tenor) : 0;
  return { pokok, totalBunga, totalBayar, angs };
}

export function KreditPageContent() {
  const [rows, setRows] = useState<KreditRow[]>([]);
  const [rowsMap, setRowsMap] = useState<Record<string, KreditRow>>({});
  const [anggotaList, setAnggotaList] = useState<AnggotaOpt[]>([]);
  const [jenisOptions, setJenisOptions] = useState<JenisOpt[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalAngsuran, setTotalAngsuran] = useState(0);
  const [bungaDef, setBungaDef] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const [q, setQ] = useState('');
  const [jenisFilter, setJenisFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('Tambah Kredit Baru');
  const [jenisSel, setJenisSel] = useState('motor');
  const [jenisCustom, setJenisCustom] = useState(false);
  const [form, setForm] = useState({
    id: '',
    anggota_id: '',
    jenis: 'motor',
    nama_barang: '',
    toko: '',
    harga_beli: '',
    dp: '0',
    bunga_pct: '1.5',
    tenor: '12',
    tgl_mulai: today(),
    status: 'aktif',
    catatan: '',
  });
  const [saving, setSaving] = useState(false);

  const [showBayar, setShowBayar] = useState(false);
  const [bayarRow, setBayarRow] = useState<KreditRow | null>(null);
  const [bayarForm, setBayarForm] = useState({ tgl: today(), metode: 'potong-gaji' });

  const preview = useMemo(
    () =>
      calcKreditPreview(
        Number(form.harga_beli) || 0,
        Number(form.dp) || 0,
        Number(form.bunga_pct) || bungaDef,
        Number(form.tenor) || 12,
      ),
    [form, bungaDef],
  );

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams();
    if (filterQ) qs.set('q', filterQ);
    if (filterJenis) qs.set('jenis', filterJenis);
    if (filterStatus) qs.set('status', filterStatus);
    const query = qs.toString() ? `?${qs}` : '';
    api
      .get<{
        rows: KreditRow[];
        anggota_list: AnggotaOpt[];
        kredit_jenis_options: JenisOpt[];
        total_outstanding: number;
        total_angsuran: number;
        bunga_reg: number;
      }>(`/kredit${query}`)
      .then((r) => {
        const list = r.rows || [];
        setRows(list);
        const map: Record<string, KreditRow> = {};
        for (const row of list) map[row.id] = row;
        setRowsMap(map);
        setAnggotaList(r.anggota_list || []);
        setJenisOptions(r.kredit_jenis_options || []);
        setTotalOutstanding(Number(r.total_outstanding) || 0);
        setTotalAngsuran(Number(r.total_angsuran) || 0);
        setBungaDef(Number(r.bunga_reg) || 1.5);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterQ, filterJenis, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setFilterQ(q);
    setFilterJenis(jenisFilter);
    setFilterStatus(statusFilter);
  }

  function resetSearch() {
    setQ('');
    setJenisFilter('');
    setStatusFilter('');
    setFilterQ('');
    setFilterJenis('');
    setFilterStatus('');
  }

  function openAdd() {
    setFormTitle('Tambah Kredit Baru');
    setJenisSel('motor');
    setJenisCustom(false);
    setForm({
      id: '',
      anggota_id: '',
      jenis: 'motor',
      nama_barang: '',
      toko: '',
      harga_beli: '',
      dp: '0',
      bunga_pct: String(bungaDef),
      tenor: '12',
      tgl_mulai: today(),
      status: 'aktif',
      catatan: '',
    });
    setShowForm(true);
  }

  function openEdit(id: string) {
    const r = rowsMap[id];
    if (!r) return;
    setFormTitle(`Edit Kredit: ${r.nama_barang || r.no}`);
    const jenis = r.jenis || 'motor';
    const known = ['motor', 'elektronik', ...jenisOptions.map((o) => o.value)];
    if (known.includes(jenis)) {
      setJenisSel(jenis);
      setJenisCustom(false);
    } else {
      setJenisSel('__tambah__');
      setJenisCustom(true);
    }
    setForm({
      id: r.id,
      anggota_id: r.anggota_id,
      jenis,
      nama_barang: r.nama_barang || '',
      toko: r.toko || '',
      harga_beli: String(r.harga_beli || 0),
      dp: String(r.dp || 0),
      bunga_pct: String(r.bunga_pct || bungaDef),
      tenor: String(r.tenor || 12),
      tgl_mulai: r.tgl_mulai || today(),
      status: r.status || 'aktif',
      catatan: r.catatan || '',
    });
    setShowForm(true);
  }

  function onJenisSelChange(val: string) {
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
    if (!form.anggota_id || !form.harga_beli) return;
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/kredit/save', {
        id: form.id,
        anggota_id: form.anggota_id,
        jenis: form.jenis,
        nama_barang: form.nama_barang,
        toko: form.toko,
        harga_beli: Number(form.harga_beli),
        dp: Number(form.dp) || 0,
        bunga_pct: Number(form.bunga_pct) || bungaDef,
        tenor: Number(form.tenor) || 12,
        tgl_mulai: form.tgl_mulai,
        status: form.status,
        catatan: form.catatan,
      });
      setFlash(r.message || 'Kredit disimpan');
      setFlashType('success');
      setShowForm(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  function openBayar(row: KreditRow) {
    setBayarRow(row);
    setBayarForm({ tgl: today(), metode: 'potong-gaji' });
    setShowBayar(true);
  }

  async function onBayar(e: FormEvent) {
    e.preventDefault();
    if (!bayarRow) return;
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>(`/kredit/bayar/${bayarRow.id}`, bayarForm);
      setFlash(r.message || 'Angsuran berhasil');
      setFlashType('success');
      setShowBayar(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal bayar');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  async function lunasKredit(row: KreditRow) {
    if (!confirm('Lunasi pinjaman ini?')) return;
    try {
      const r = await api.get<{ message?: string }>(`/kredit/lunas/${row.id}`);
      setFlash(r.message || 'Kredit dilunasi');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal pelunasan');
      setFlashType('danger');
    }
  }

  async function deleteKredit(row: KreditRow) {
    if (!confirm('Hapus kredit ini?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/kredit/delete/${row.id}`);
      setFlash(r.message || 'Kredit dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
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
            <IconRenderer icon={ICON_MAP.pinjaman_custom} size={24} style={{ marginRight: 8 }} />
            Kredit Motor & Elektronik
          </h2>
          <p>
            Outstanding: <b>Rp {fmtRp(totalOutstanding)}</b> · Angsuran/bln: <b>Rp {fmtRp(totalAngsuran)}</b>
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <a href={api.exportUrl('/kredit/export?fmt=xlsx')} className="btn btn-sm btn-outline-success" style={btnStyle} target="_blank" rel="noreferrer">
            Excel
          </a>
          <a href={api.exportUrl('/kredit/export?fmt=csv')} className="btn btn-sm btn-outline-secondary" style={btnStyle} target="_blank" rel="noreferrer">
            CSV
          </a>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openAdd}>
            Tambah Kredit
          </button>
        </div>
      </div>

      <div className="p-3 mb-3 rounded no-print" style={{ background: 'linear-gradient(135deg,#EFF6FF,#F0FDF4)', border: '1px solid #BFDBFE', fontSize: 12 }}>
        <div className="row g-3">
          <div className="col-md-8">
            <b>Cara Kerja Kredit Motor & Elektronik</b>
            <br />
            <span style={{ color: '#475569' }}>
              Anggota ingin beli motor/elektronik → Koperasi bayar ke toko → Anggota cicil ke koperasi dengan bunga ringan.
              Angsuran otomatis muncul di Slip Potongan Gaji bagian TOKO (baris: KREDIT MOTOR / KREDIT ELEKTRONIK).
            </span>
          </div>
          <div className="col-md-4">
            <div className="row g-1 text-center">
              <div className="col-6">
                <div className="p-2 rounded" style={{ background: '#fff', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: 10, color: '#1D4ED8', fontWeight: 600 }}>KREDIT MOTOR</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-2 rounded" style={{ background: '#fff', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>KREDIT ELEKTRONIK</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form className="toolbar no-print" onSubmit={applySearch}>
        <select className="form-select form-select-sm" style={{ width: 170, borderRadius: 6 }} value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)}>
          <option value="">Semua Jenis</option>
          <option value="motor">Motor</option>
          <option value="elektronik">Elektronik</option>
        </select>
        <select className="form-select form-select-sm" style={{ width: 120, borderRadius: 6 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="lunas">Lunas</option>
        </select>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / no barang..."
          className="form-control form-control-sm"
          style={{ width: 200, borderRadius: 6 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={btnStyle}>
          Cari
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" style={btnStyle} onClick={resetSearch}>
          Reset
        </button>
      </form>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th>No Kredit</th>
              <th>Anggota</th>
              <th>Jenis</th>
              <th>Nama Barang / Kendaraan</th>
              <th>Toko</th>
              <th className="text-end">Harga Beli</th>
              <th className="text-end">DP</th>
              <th className="text-end">Pokok</th>
              <th className="text-center">Bunga/bln</th>
              <th className="text-center">Tenor</th>
              <th className="text-end">Angsuran/bln</th>
              <th className="text-end">Sisa</th>
              <th className="text-center">Progress</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center text-muted py-4">
                  Belum ada data kredit motor & elektronik
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const pct = r.tenor > 0 ? Math.min(100, Math.round((r.cicilan_ke / r.tenor) * 100)) : 0;
                return (
                  <tr key={r.id} className={r.status === 'lunas' ? 'table-success' : ''}>
                    <td>
                      <span className="mono" style={{ fontSize: 10 }}>
                        {r.no}
                      </span>
                    </td>
                    <td className="fw-semibold" style={{ fontSize: 12 }}>
                      {r.anggota_nama}
                      <br />
                      <span className="mono" style={{ fontSize: 9, color: '#94A3B8' }}>
                        {r.nip}
                      </span>
                    </td>
                    <td>
                      {r.jenis === 'motor' ? (
                        <span className="bd bd-amber">Motor</span>
                      ) : r.jenis === 'elektronik' ? (
                        <span className="bd bd-blue">Elektronik</span>
                      ) : (
                        <span className="bd bd-gray">{r.jenis}</span>
                      )}
                    </td>
                    <td className="fw-semibold" style={{ fontSize: 12 }}>
                      {r.nama_barang || '—'}
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B' }}>{r.toko || '—'}</td>
                    <td className="text-end mono">{fmtRp(r.harga_beli)}</td>
                    <td className="text-end mono" style={{ color: '#64748B' }}>
                      {fmtRp(r.dp)}
                    </td>
                    <td className="text-end mono">{fmtRp(r.pokok)}</td>
                    <td className="text-center">
                      <span className="bd bd-gray">{r.bunga_pct}%</span>
                    </td>
                    <td className="text-center">{r.tenor} bln</td>
                    <td className="text-end mono fw-bold" style={{ color: '#0F2744' }}>
                      {fmtRp(r.angsuran)}
                    </td>
                    <td className="text-end mono" style={{ color: '#DC2626' }}>
                      {fmtRp(r.sisa_pokok)}
                    </td>
                    <td className="text-center" style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>
                        {r.cicilan_ke}/{r.tenor}
                      </div>
                      <div className="prog">
                        <div className="prog-fill pf-navy" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td>
                      <span className={`bd ${r.status === 'lunas' ? 'bd-green' : 'bd-amber'}`}>{r.status}</span>
                    </td>
                    <td className="no-print text-nowrap">
                      {r.status === 'aktif' && (
                        <>
                          <button type="button" className="btn btn-act btn-navy me-1" onClick={() => openBayar(r)}>
                            Angsur
                          </button>
                          <button type="button" className="btn btn-act btn-outline-success me-1" onClick={() => lunasKredit(r)}>
                            Lunas
                          </button>
                        </>
                      )}
                      <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => openEdit(r.id)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button type="button" className="btn btn-act btn-outline-danger" onClick={() => deleteKredit(r)}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={formTitle} size="lg">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-md-8">
                <label className="fl">Anggota *</label>
                <select
                  className="form-select form-select-sm"
                  value={form.anggota_id}
                  onChange={(e) => setForm({ ...form, anggota_id: e.target.value })}
                  required
                >
                  <option value="">— Pilih Anggota —</option>
                  {anggotaList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.no} — {a.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="fl">Jenis Kredit *</label>
                <select className="form-select form-select-sm" value={jenisSel} onChange={(e) => onJenisSelChange(e.target.value)}>
                  <option value="motor">Motor / Kendaraan</option>
                  <option value="elektronik">Elektronik</option>
                  {jenisOptions
                    .filter((o) => !['motor', 'elektronik'].includes(o.value))
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  <option value="__tambah__">Tambah Jenis Baru...</option>
                </select>
                {jenisCustom && (
                  <input
                    className="form-control form-control-sm mt-1"
                    placeholder="Ketik jenis baru..."
                    value={form.jenis}
                    onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                  />
                )}
              </div>
              <div className="col-md-8">
                <label className="fl">Nama Barang / Kendaraan</label>
                <input
                  className="form-control form-control-sm"
                  value={form.nama_barang}
                  onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
                  placeholder="mis: Honda Beat 2024 CBS"
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Toko / Dealer</label>
                <input
                  className="form-control form-control-sm"
                  value={form.toko}
                  onChange={(e) => setForm({ ...form, toko: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Tgl Mulai Kredit</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={form.tgl_mulai}
                  onChange={(e) => setForm({ ...form, tgl_mulai: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Status</label>
                <select className="form-select form-select-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="aktif">Aktif</option>
                  <option value="lunas">Lunas</option>
                </select>
              </div>
              <div className="col-12">
                <hr style={{ margin: '6px 0' }} />
                <b style={{ fontSize: 12, color: '#0F2744' }}>Perhitungan Kredit</b>
              </div>
              <div className="col-md-4">
                <label className="fl">Harga Beli (Rp) *</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={form.harga_beli}
                  onChange={(e) => setForm({ ...form, harga_beli: e.target.value })}
                  required
                  min={0}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">DP / Uang Muka (Rp)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={form.dp}
                  onChange={(e) => setForm({ ...form, dp: e.target.value })}
                  min={0}
                />
              </div>
              <div className="col-md-4">
                <label className="fl">Pokok Pinjaman (Auto)</label>
                <div className="p-2 rounded fw-semibold" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: 13, color: '#0F2744', minHeight: 32 }}>
                  Rp {fmtRp(preview.pokok)}
                </div>
              </div>
              <div className="col-md-3">
                <label className="fl">Bunga (%/bulan)</label>
                <input
                  type="number"
                  step={0.1}
                  className="form-control form-control-sm"
                  value={form.bunga_pct}
                  onChange={(e) => setForm({ ...form, bunga_pct: e.target.value })}
                />
              </div>
              <div className="col-md-3">
                <label className="fl">Tenor (bulan)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={form.tenor}
                  onChange={(e) => setForm({ ...form, tenor: e.target.value })}
                  min={1}
                  max={60}
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Detail Perhitungan</label>
                <div className="p-2 rounded" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 11 }}>
                  <div className="d-flex justify-content-between">
                    <span>Pokok</span>
                    <span className="fw-semibold">Rp {fmtRp(preview.pokok)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Total Bunga</span>
                    <span style={{ color: '#D97706' }}>Rp {fmtRp(preview.totalBunga)}</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ borderTop: '1px solid #BFDBFE', marginTop: 3, paddingTop: 3 }}>
                    <span>
                      <b>Total Bayar</b>
                    </span>
                    <span className="fw-bold">Rp {fmtRp(preview.totalBayar)}</span>
                  </div>
                  <div
                    className="d-flex justify-content-between mt-1"
                    style={{ background: '#fff', padding: '4px 6px', borderRadius: 4, border: '1px solid #93C5FD' }}
                  >
                    <span>
                      <b>Angsuran/bln</b>
                    </span>
                    <span className="fw-bold" style={{ color: '#1D4ED8', fontSize: 13 }}>
                      Rp {fmtRp(preview.angs)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-12">
                <label className="fl">Catatan</label>
                <input className="form-control form-control-sm" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowForm(false)} saving={saving} submitLabel="Simpan Kredit" />
        </form>
      </Modal>

      <Modal open={showBayar} onClose={() => setShowBayar(false)} title="Bayar Angsuran Kredit" size="md">
        <form onSubmit={onBayar}>
          <div className="modal-body">
            <div className="p-2 rounded mb-2" style={{ background: '#EFF6FF', fontSize: 12 }}>
              <b>{bayarRow?.no}</b>
            </div>
            <div className="mb-2" style={{ fontSize: 13 }}>
              Jumlah angsuran: <b className="text-success">Rp {fmtRp(bayarRow?.angsuran)}</b>
            </div>
            <div className="row g-2">
              <div className="col-md-6">
                <label className="fl">Tanggal</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={bayarForm.tgl}
                  onChange={(e) => setBayarForm({ ...bayarForm, tgl: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="fl">Metode Pembayaran</label>
                <select
                  className="form-select form-select-sm"
                  value={bayarForm.metode}
                  onChange={(e) => setBayarForm({ ...bayarForm, metode: e.target.value })}
                >
                  {METODE_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowBayar(false)} saving={saving} submitLabel="Konfirmasi Pembayaran" />
        </form>
      </Modal>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type LaborKontrak = {
  id: string;
  no: string;
  klien: string;
  pekerjaan: string;
  lokasi: string;
  nilai_kontrak: number;
};

type LaborPekerja = {
  id: string;
  kontrak_id: string;
  nama: string;
  jabatan: string;
  nik: string;
  bulan: string;
  jumlah_orang: number;
  biaya: number;
  biaya_lembur: number;
  biaya_tambahan: number;
  total_biaya: number;
  pph21: number;
};

type Summary = {
  manpower: number;
  lembur: number;
  tambahan: number;
  total: number;
};

export function LaborDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const kid = String(params.kid || '');

  const [kontrak, setKontrak] = useState<LaborKontrak | null>(null);
  const [pekerja, setPekerja] = useState<LaborPekerja[]>([]);
  const [summary, setSummary] = useState<Summary>({ manpower: 0, lembur: 0, tambahan: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'danger'>('success');
  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState({
    id: '',
    nama: '',
    jabatan: '',
    nik: '',
    bulan: today().slice(0, 7),
    jumlah_orang: '1',
    biaya: '0',
    biaya_lembur: '0',
    biaya_tambahan: '0',
  });

  const load = () => {
    setLoading(true);
    setErr('');
    api
      .get<{ kontrak: LaborKontrak; pekerja: LaborPekerja[]; summary: Summary }>(
        `/labor/pekerja/${kid}`,
      )
      .then((r) => {
        setKontrak(r.kontrak || null);
        setPekerja(r.pekerja || []);
        setSummary(r.summary || { manpower: 0, lembur: 0, tambahan: 0, total: 0 });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [kid]);

  async function onAddPekerja(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) {
      setFlash('Nama pekerja harus diisi');
      setFlashType('danger');
      return;
    }

    try {
      const r = await api.post<{ message?: string }>('/labor/pekerja/save', {
        id: form.id || undefined,
        kontrak_id: kid,
        nama: form.nama,
        jabatan: form.jabatan,
        nik: form.nik,
        bulan: form.bulan,
        jumlah_orang: Number(form.jumlah_orang) || 1,
        biaya: Number(form.biaya) || 0,
        biaya_lembur: Number(form.biaya_lembur) || 0,
        biaya_tambahan: Number(form.biaya_tambahan) || 0,
      });
      setFlash(r.message || 'Pekerja ditambahkan');
      setFlashType('success');
      setShowAddForm(false);
      setForm({
        id: '',
        nama: '',
        jabatan: '',
        nik: '',
        bulan: today().slice(0, 7),
        jumlah_orang: '1',
        biaya: '0',
        biaya_lembur: '0',
        biaya_tambahan: '0',
      });
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menambahkan');
      setFlashType('danger');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (err || !kontrak) {
    return (
      <>
        <Flash message={err || 'Kontrak tidak ditemukan'} type="danger" />
        <Link href="/labor" className="btn btn-sm btn-secondary">
          ← Kembali ke Labor Supply
        </Link>
      </>
    );
  }

  return (
    <>
      {flash && <Flash message={flash} type={flashType} onClose={() => setFlash('')} />}

      <div className="mb-3">
        <Link href="/labor" className="btn btn-sm btn-outline-secondary">
          ← Kembali ke Labor Supply
        </Link>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h4>{kontrak.no}</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Klien:</strong> {kontrak.klien}
              </p>
              <p>
                <strong>Pekerjaan:</strong> {kontrak.pekerjaan}
              </p>
              <p>
                <strong>Lokasi:</strong> {kontrak.lokasi}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Nilai Kontrak:</strong> Rp {fmtRp(kontrak.nilai_kontrak)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info">
        <strong>Summary Biaya:</strong>
        <div className="row mt-2">
          <div className="col-md-3">
            <small>Biaya Pokok: Rp {fmtRp(summary.manpower)}</small>
          </div>
          <div className="col-md-3">
            <small>Biaya Lembur: Rp {fmtRp(summary.lembur)}</small>
          </div>
          <div className="col-md-3">
            <small>Biaya Tambahan: Rp {fmtRp(summary.tambahan)}</small>
          </div>
          <div className="col-md-3">
            <small className="fw-bold">Total: Rp {fmtRp(summary.total)}</small>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          + {form.id ? 'Edit' : 'Tambah'} Pekerja
        </button>
      </div>

      {showAddForm && (
        <div className="card mb-3">
          <div className="card-body">
            <form onSubmit={onAddPekerja}>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <label className="form-label">Nama Pekerja</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6 mb-2">
                  <label className="form-label">Jabatan</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.jabatan}
                    onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <label className="form-label">NIK</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.nik}
                    onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  />
                </div>
                <div className="col-md-6 mb-2">
                  <label className="form-label">Bulan</label>
                  <input
                    type="month"
                    className="form-control form-control-sm"
                    value={form.bulan}
                    onChange={(e) => setForm({ ...form, bulan: e.target.value })}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-3 mb-2">
                  <label className="form-label">Jumlah Orang</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.jumlah_orang}
                    onChange={(e) => setForm({ ...form, jumlah_orang: e.target.value })}
                    min="1"
                  />
                </div>
                <div className="col-md-3 mb-2">
                  <label className="form-label">Biaya/Bulan</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.biaya}
                    onChange={(e) => setForm({ ...form, biaya: e.target.value })}
                    min="0"
                  />
                </div>
                <div className="col-md-3 mb-2">
                  <label className="form-label">Biaya Lembur</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.biaya_lembur}
                    onChange={(e) => setForm({ ...form, biaya_lembur: e.target.value })}
                    min="0"
                  />
                </div>
                <div className="col-md-3 mb-2">
                  <label className="form-label">Biaya Tambahan</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.biaya_tambahan}
                    onChange={(e) => setForm({ ...form, biaya_tambahan: e.target.value })}
                    min="0"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-sm btn-success">
                Simpan Pekerja
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary ms-2"
                onClick={() => setShowAddForm(false)}
              >
                Batal
              </button>
            </form>
          </div>
        </div>
      )}

      {pekerja.length === 0 ? (
        <p className="text-muted">Belum ada data pekerja.</p>
      ) : (
        <div className="tbl-wrap tbl-scroll-x">
          <table className="table table-sm table-hover">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jabatan</th>
                <th>NIK</th>
                <th>Bulan</th>
                <th>Jml Org</th>
                <th>Biaya/Org</th>
                <th>Lembur</th>
                <th>Tambahan</th>
                <th>Total</th>
                <th>PPh 21</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pekerja.map((p) => (
                <tr
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setShowAddForm(true);
                    setForm({
                      id: p.id,
                      nama: p.nama || '',
                      jabatan: p.jabatan || '',
                      nik: p.nik || '',
                      bulan: p.bulan || today().slice(0, 7),
                      jumlah_orang: String(p.jumlah_orang || 1),
                      biaya: String(p.biaya || 0),
                      biaya_lembur: String(p.biaya_lembur || 0),
                      biaya_tambahan: String(p.biaya_tambahan || 0),
                    });
                  }}
                >
                  <td>{p.nama}</td>
                  <td>{p.jabatan}</td>
                  <td>
                    <small>{p.nik}</small>
                  </td>
                  <td>
                    <small>{p.bulan}</small>
                  </td>
                  <td className="text-center">{p.jumlah_orang}</td>
                  <td className="text-end">Rp {fmtRp(p.biaya)}</td>
                  <td className="text-end">Rp {fmtRp(p.biaya_lembur)}</td>
                  <td className="text-end">Rp {fmtRp(p.biaya_tambahan)}</td>
                  <td className="text-end fw-bold">Rp {fmtRp(p.total_biaya)}</td>
                  <td className="text-end">Rp {fmtRp(p.pph21)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <a href={`/labor/timesheet/${p.id}`} className="btn btn-xs btn-outline-secondary py-0 px-1">
                      ⏱
                    </a>
                    <a
                      href={`/labor/slip/${p.id}`}
                      className="btn btn-xs btn-outline-secondary py-0 px-1 ms-1"
                      target="_blank"
                      rel="noreferrer"
                    >
                      📄
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

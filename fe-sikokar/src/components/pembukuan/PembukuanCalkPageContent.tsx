'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type CalkInfo = {
  nama_koperasi: string;
  alamat: string;
  tahun: string;
  jml_anggota_aktif: number;
  jml_anggota_keluar: number;
  total_simpanan: number;
  total_pinjaman_aktif: number;
  persentase_shu: Record<string, string>;
  bunga_pinjaman_regular: string;
  bunga_pinjaman_darurat: string;
  bunga_jasa_simpanan: string;
};

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

export function PembukuanCalkPageContent() {
  const searchParams = useSearchParams();
  const [tahun, setTahun] = useState(searchParams.get('tahun') || today().slice(0, 4));
  const [info, setInfo] = useState<CalkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ info: CalkInfo }>(`/pembukuan/calk?tahun=${tahun}`)
      .then((r) => setInfo(r.info || null))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => {
    load();
  }, [load]);

  const ps = info?.persentase_shu || {};

  return (
    <>
      {err && <Flash message={err} type="danger" />}
      <div className="mb-2 no-print">
        <Link href="/pembukuan" className="btn btn-sm btn-outline-secondary">
          ← Pembukuan
        </Link>
      </div>
      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>📖 Catatan Atas Laporan Keuangan</h2>
          <p>Tahun {tahun}</p>
        </div>
        <div className="pg-hdr-right no-print">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
      <form
        className="toolbar no-print mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>Tahun:</label>
        <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="form-select form-select-sm" style={{ width: 120 }}>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </form>
      {loading || !info ? (
        <div className="text-center py-4">
          <div className="spinner-border" />
        </div>
      ) : (
        <div className="card" style={{ borderRadius: 8, maxWidth: 850 }}>
          <div className="card-body" style={{ fontSize: '12pt', lineHeight: 1.7 }}>
            <h3 className="text-center" style={{ color: '#0F2744' }}>
              CATATAN ATAS LAPORAN KEUANGAN
            </h3>
            <h4 className="text-center" style={{ color: '#0F2744' }}>
              {info.nama_koperasi}
            </h4>
            <p className="text-center mb-4">Untuk Tahun yang Berakhir 31 Desember {info.tahun}</p>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>1. INFORMASI UMUM</h5>
            <p>
              1.1 <b>Identitas Koperasi</b>
              <br />
              {info.nama_koperasi}
              <br />
              Alamat: {info.alamat || '(belum diisi)'}
            </p>
            <p>
              1.2 <b>Bidang Usaha</b>
              <br />
              Koperasi menjalankan usaha simpan pinjam, perdagangan (toko), jasa rental, labor supply, PPOB, dan kwitansi.
            </p>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>2. KEANGGOTAAN</h5>
            <p>
              Anggota aktif: <b>{info.jml_anggota_aktif}</b>. Keluar/pensiun/meninggal: {info.jml_anggota_keluar}.
            </p>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>3. KEBIJAKAN AKUNTANSI</h5>
            <p>Laporan keuangan disusun berdasarkan SAK ETAP untuk koperasi. Mata uang: Rupiah (Rp).</p>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>4. SIMPANAN ANGGOTA</h5>
            <p>
              Total simpanan: <b>Rp {fmtRp(info.total_simpanan)}</b>. Hasil jasa simpanan: <b>{info.bunga_jasa_simpanan}%</b> per tahun.
            </p>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>5. PINJAMAN</h5>
            <p>
              Pinjaman aktif: <b>Rp {fmtRp(info.total_pinjaman_aktif)}</b>. Bunga regular: {info.bunga_pinjaman_regular}%/bln, darurat:{' '}
              {info.bunga_pinjaman_darurat}%/bln.
            </p>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>6. PEMBAGIAN SHU</h5>
            <table style={{ width: '60%', borderCollapse: 'collapse', marginLeft: 20, fontSize: 12 }}>
              <tbody>
                <tr>
                  <td>Dana Cadangan</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{ps.cadangan || ps.shu_cadangan_pct || '—'}%</b>
                  </td>
                </tr>
                <tr>
                  <td>Simpanan Anggota</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{ps.simpanan_anggota || '—'}%</b>
                  </td>
                </tr>
                <tr>
                  <td>Bunga Pinjaman</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{ps.bunga_pinjaman || '—'}%</b>
                  </td>
                </tr>
                <tr>
                  <td>Konsumsi</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{ps.konsumsi || '—'}%</b>
                  </td>
                </tr>
                <tr>
                  <td>Dana Pengurus</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{ps.pengurus || '—'}%</b>
                  </td>
                </tr>
                <tr>
                  <td>Dana Sosial</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{ps.sosial || '—'}%</b>
                  </td>
                </tr>
              </tbody>
            </table>
            <h5 style={{ color: '#1D4ED8', marginTop: 20 }}>7. PERISTIWA SETELAH TANGGAL NERACA</h5>
            <p>Tidak terdapat peristiwa material yang memerlukan pengungkapan.</p>
            <p className="text-end mt-4">
              <br />
              <br />
              <b>Pengurus Koperasi</b>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

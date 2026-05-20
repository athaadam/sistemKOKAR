'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, bulanIni, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { ReportExportBar } from '@/components/report/ReportExportBar';

type Row = {
  no: string;
  nip: string;
  nama: string;
  dept: string;
  belanja_toko: number;
  simpanan_wajib: number;
  cicilan_pinjaman: number;
  tunggakan: number;
  total_potongan: number;
};

type Hdr = {
  logo?: string;
  header1?: string;
  header2?: string;
  nama_kop?: string;
  alamat?: string;
};

function n(v: unknown): number {
  return Number(v) || 0;
}

export function SummaryGajiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bulan = searchParams.get('bulan') || bulanIni();

  const [rows, setRows] = useState<Row[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [hdr, setHdr] = useState<Hdr>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const exportPath = `/laporan/summary_gaji/export?bulan=${encodeURIComponent(bulan)}`;

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: Row[]; grand_total: number; hdr: Hdr }>(`/laporan/summary_gaji?bulan=${encodeURIComponent(bulan)}`)
      .then((r) => {
        setRows(r.rows || []);
        setGrandTotal(n(r.grand_total));
        setHdr(r.hdr || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;

  const logoUrl = hdr.logo ? `/${hdr.logo.replace(/^\/+/, '')}` : null;
  const sum = (key: keyof Row) => rows.reduce((s, r) => s + n(r[key]), 0);

  return (
    <>
      <div className="pg-hdr no-print">
        <div className="pg-hdr-left">
          <h2>📄 Summary Potongan Gaji</h2>
          <p>Periode: <b>{bulan}</b> · {rows.length} anggota</p>
        </div>
        <ReportExportBar
          exportPath={exportPath}
          extra={
            <>
              <input
                type="month"
                value={bulan}
                className="form-control form-control-sm"
                style={{ width: 160, borderRadius: 6 }}
                onChange={(e) => router.push(`/laporan/summary-gaji?bulan=${e.target.value}`)}
              />
              <Link href="/laporan" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6, fontSize: 12 }}>
                ← Laporan
              </Link>
            </>
          }
        />
      </div>

      <div className="p-3" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
        <div className="d-flex align-items-center gap-3 border-bottom pb-2 mb-3" style={{ borderColor: '#0F2744', borderWidth: 2 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="logo" style={{ maxHeight: 55 }} />
          ) : (
            <div style={{ width: 50, height: 50, background: '#0F2744', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff' }}>🏛️</div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: '#0F2744' }}>{hdr.header1 || hdr.nama_kop}</div>
            <div style={{ fontSize: 11, color: '#555' }}>{hdr.header2 || hdr.alamat}</div>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>LAPORAN SUMMARY POTONGAN GAJI</div>
          </div>
        </div>

        <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
          <table className="table table-bordered table-sm" style={{ minWidth: 900, fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0F2744', color: '#fff' }}>
                <th>No</th><th>No Ang</th><th>NIP</th><th>Nama</th><th>Dept</th>
                <th className="text-end">Belanja Toko</th><th className="text-end">Simpanan Wajib</th>
                <th className="text-end">Cicilan+Bunga</th><th className="text-end">Tunggakan</th>
                <th className="text-end">Total Potongan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={n(r.tunggakan) > 0 ? 'table-warning' : ''}>
                  <td className="text-muted">{i + 1}</td>
                  <td><b>{r.no}</b></td>
                  <td style={{ fontSize: 10 }}>{r.nip}</td>
                  <td><b>{r.nama}</b></td>
                  <td style={{ fontSize: 10, color: '#555' }}>{r.dept}</td>
                  <td className="text-end">{n(r.belanja_toko) > 0 ? fmtRp(r.belanja_toko) : '—'}</td>
                  <td className="text-end">{n(r.simpanan_wajib) > 0 ? fmtRp(r.simpanan_wajib) : '—'}</td>
                  <td className="text-end">{n(r.cicilan_pinjaman) > 0 ? fmtRp(r.cicilan_pinjaman) : '—'}</td>
                  <td className={`text-end ${n(r.tunggakan) > 0 ? 'text-danger fw-bold' : ''}`}>
                    {n(r.tunggakan) > 0 ? fmtRp(r.tunggakan) : '—'}
                  </td>
                  <td className="text-end fw-bold" style={{ color: '#0F2744' }}>{fmtRp(r.total_potongan)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={10} className="text-center text-muted py-3">Tidak ada potongan untuk periode ini</td></tr>}
            </tbody>
            {!!rows.length && (
              <tfoot>
                <tr style={{ background: '#E8F4F8', fontWeight: 'bold' }}>
                  <td colSpan={5} className="text-end">TOTAL ({rows.length} anggota)</td>
                  <td className="text-end">{fmtRp(sum('belanja_toko'))}</td>
                  <td className="text-end">{fmtRp(sum('simpanan_wajib'))}</td>
                  <td className="text-end">{fmtRp(sum('cicilan_pinjaman'))}</td>
                  <td className="text-end">{fmtRp(sum('tunggakan'))}</td>
                  <td className="text-end" style={{ color: '#0F2744' }}>{fmtRp(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 8 }}>Dicetak: {today()}</div>
      </div>
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, today, bulanIni } from '@/lib/format';

type RingkasanRow = {
  urut: number;
  no: string;
  nip?: string;
  nama: string;
  dept?: string;
  toko: number;
  simpanan: number;
  cicilan: number;
  tunggakan: number;
  total: number;
};

type Grand = {
  toko: number;
  simpanan: number;
  cicilan: number;
  tunggakan: number;
  total: number;
};

export function PinjamanKolektifRingkasanPageContent() {
  const searchParams = useSearchParams();
  const [bulan, setBulan] = useState(searchParams.get('bulan') || bulanIni());
  const [rows, setRows] = useState<RingkasanRow[]>([]);
  const [grand, setGrand] = useState<Grand>({ toko: 0, simpanan: 0, cicilan: 0, tunggakan: 0, total: 0 });
  const [hdr, setHdr] = useState<{ header1?: string; header2?: string; nama_kop?: string; alamat?: string }>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: RingkasanRow[]; grand: Grand; bulan: string; hdr: Record<string, string> }>(
        `/pinjaman/kolektif/ringkasan?bulan=${encodeURIComponent(bulan)}`,
      )
      .then((r) => {
        setRows(r.rows || []);
        setGrand(r.grand || { toko: 0, simpanan: 0, cicilan: 0, tunggakan: 0, total: 0 });
        if (r.bulan) setBulan(r.bulan);
        setHdr(r.hdr || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !rows.length) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-4">
        <p className="text-danger">{err}</p>
        <Link href="/pinjaman/kolektif">Kembali</Link>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Belanja Toko', val: grand.toko, color: '#1D4ED8' },
    { label: 'Total Simpanan', val: grand.simpanan, color: '#7C3AED' },
    { label: 'Total Cicilan+Bunga', val: grand.cicilan, color: '#D97706' },
    { label: 'Total Tunggakan', val: grand.tunggakan, color: '#DC2626' },
    { label: 'GRAND TOTAL POTONGAN', val: grand.total, color: '#0F2744' },
  ];

  return (
    <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '10.5px', padding: 10 }}>
      <style>{`
        .rk-hdr { display: flex; align-items: center; gap: 12px; border: 2px solid #0f2744; padding: 7px 12px; margin-bottom: 8px; }
        .rk-tbl { width: 100%; border-collapse: collapse; font-size: 10px; }
        .rk-tbl thead th { background: #0f2744; color: #fff; padding: 5px 7px; border: 1px solid #0f2744; }
        .rk-tbl tbody td { padding: 4px 7px; border: 1px solid #cbd5e1; }
        .rk-tbl tbody tr:nth-child(even) { background: #f8fafc; }
        .rk-tbl tfoot td { background: #0f2744; color: #fff; font-weight: bold; padding: 5px 7px; }
        .rk-num { text-align: right; font-family: 'Courier New', monospace; }
        @media print { .no-print { display: none !important; } body { padding: 4px; } }
      `}</style>

      <div className="no-print mb-2 d-flex gap-2 flex-wrap align-items-center">
        <button type="button" onClick={() => window.print()} className="btn btn-sm btn-navy">
          Print Ringkasan
        </button>
        <a href={api.exportUrl(`/pinjaman/kolektif/ringkasan/export?bulan=${bulan}&fmt=xlsx`)} className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer">
          Excel
        </a>
        <a href={api.exportUrl(`/pinjaman/kolektif/ringkasan/export?bulan=${bulan}&fmt=csv`)} className="btn btn-sm btn-outline-secondary" target="_blank" rel="noreferrer">
          CSV
        </a>
        <Link href={`/pinjaman/kolektif?bulan=${bulan}`} className="btn btn-sm btn-outline-secondary">
          Kembali
        </Link>
        <div className="ms-auto d-flex align-items-center gap-2">
          <label style={{ fontSize: 11, color: '#555' }}>Bulan:</label>
          <input type="month" className="form-control form-control-sm" style={{ width: 165 }} value={bulan} onChange={(e) => setBulan(e.target.value)} />
        </div>
      </div>

      <div className="rk-hdr">
        <div style={{ width: 46, height: 46, background: '#0F2744', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          🏛️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#0F2744' }}>{hdr.header1 || hdr.nama_kop || 'SIKOKAR'}</div>
          <div style={{ fontSize: 9 }}>{hdr.header2 || hdr.alamat}</div>
        </div>
        <div className="text-end">
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#0F2744' }}>SLIP RINGKASAN POTONGAN GAJI</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>
            Bulan: <b>{bulan}</b> · {rows.length} anggota
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 mb-2 flex-wrap no-print">
        {summaryCards.map((c) => (
          <div key={c.label} style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: 5, borderLeft: `3px solid ${c.color}` }}>
            <div style={{ fontSize: '8.5px', color: '#64748B' }}>{c.label}</div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: c.color }}>{fmtRp(c.val)}</div>
          </div>
        ))}
      </div>

      <table className="rk-tbl">
        <thead>
          <tr>
            <th style={{ width: 28 }}>No</th>
            <th>No Ang</th>
            <th>NIP</th>
            <th>Nama Anggota</th>
            <th>Dept</th>
            <th className="rk-num">Belanja Toko</th>
            <th className="rk-num">Simpanan</th>
            <th className="rk-num">Cicilan+Bunga</th>
            <th className="rk-num">Tunggakan</th>
            <th className="rk-num">TOTAL POTONGAN</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center text-muted py-3">
                Tidak ada data
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={`${r.no}-${r.urut}`}>
                <td className="text-center" style={{ color: '#94A3B8' }}>
                  {r.urut}
                </td>
                <td>
                  <b>{r.no}</b>
                </td>
                <td style={{ fontSize: '9.5px' }}>{r.nip}</td>
                <td>
                  <b>{r.nama}</b>
                </td>
                <td style={{ color: '#555', fontSize: 9 }}>{r.dept}</td>
                <td className={`rk-num ${r.toko === 0 ? 'text-muted' : ''}`}>{r.toko ? fmtRp(r.toko) : '—'}</td>
                <td className={`rk-num ${r.simpanan === 0 ? 'text-muted' : ''}`}>{r.simpanan ? fmtRp(r.simpanan) : '—'}</td>
                <td className={`rk-num ${r.cicilan === 0 ? 'text-muted' : ''}`} style={r.cicilan > 0 ? { fontWeight: 'bold' } : undefined}>
                  {r.cicilan ? fmtRp(r.cicilan) : '—'}
                </td>
                <td className={`rk-num ${r.tunggakan === 0 ? 'text-muted' : ''}`} style={r.tunggakan > 0 ? { color: '#DC2626', fontWeight: 'bold' } : undefined}>
                  {r.tunggakan ? fmtRp(r.tunggakan) : '—'}
                </td>
                <td className="rk-num" style={{ fontWeight: 'bold', background: '#F0FDF4', color: '#0F2744', fontSize: 11 }}>
                  {fmtRp(r.total)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={5} className="text-end">
                TOTAL ({rows.length} anggota)
              </td>
              <td className="rk-num">{fmtRp(grand.toko)}</td>
              <td className="rk-num">{fmtRp(grand.simpanan)}</td>
              <td className="rk-num">{fmtRp(grand.cicilan)}</td>
              <td className="rk-num">{fmtRp(grand.tunggakan)}</td>
              <td className="rk-num" style={{ fontSize: 12, background: '#064E3B' }}>
                {fmtRp(grand.total)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      <div className="d-flex justify-content-between mt-4 gap-3" style={{ fontSize: 9 }}>
        {['Koperasi / Admin', 'HRD / Penggajian', 'Pimpinan / Direktur'].map((t) => (
          <div key={t} style={{ borderTop: '1px solid #333', paddingTop: 3, textAlign: 'center', flex: 1 }}>
            <div style={{ height: 40 }} />
            {t}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: '#888', marginTop: 8, textAlign: 'right' }}>Dicetak: {today()}</div>
    </div>
  );
}

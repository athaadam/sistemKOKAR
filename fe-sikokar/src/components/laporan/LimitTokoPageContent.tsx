'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, bulanIni } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type Row = {
  anggota_no: string;
  anggota_nama: string;
  nip: string;
  terpakai: number;
  sisa: number;
  pct: number;
  piutang_now: number;
  status: string;
};

export function LimitTokoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bulan = searchParams.get('bulan') || bulanIni();
  const [draftBulan, setDraftBulan] = useState(bulan);

  const [rows, setRows] = useState<Row[]>([]);
  const [limitGlobal, setLimitGlobal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: Row[]; limit_global: number }>(`/laporan/limit_toko?bulan=${encodeURIComponent(bulan)}`)
      .then((r) => {
        setRows(r.rows || []);
        setLimitGlobal(Number(r.limit_global) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDraftBulan(bulan);
  }, [bulan]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    router.push(`/laporan/limit-toko?bulan=${draftBulan}`);
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>📊 Limit Kredit Toko Per Anggota</h2>
          <p>
            Bulan: <b>{bulan}</b> · Limit Global: <b>Rp {fmtRp(limitGlobal)}/anggota</b>
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <Link href="/laporan" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6, fontSize: 12 }}>
            ← Laporan
          </Link>
        </div>
      </div>

      <form className="toolbar no-print mb-2 d-flex gap-2 align-items-center" onSubmit={onFilter}>
        <input
          type="month"
          value={draftBulan}
          onChange={(e) => setDraftBulan(e.target.value)}
          className="form-control form-control-sm"
          style={{ width: 165 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>Filter</button>
      </form>

      <div className="tbl-wrap">
        <table className="table table-sm" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>No Anggota</th><th>Nama</th><th>NIP</th><th className="text-end">Terpakai</th>
              <th className="text-end">Sisa</th><th>Progress</th><th className="text-end">Piutang</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = Math.min(100, Number(r.pct) || 0);
              const barColor = pct > 80 ? '#DC2626' : '#16A34A';
              return (
                <tr key={i} className={r.status === 'suspend' ? 'table-warning' : ''}>
                  <td className="mono">{r.anggota_no}</td>
                  <td className="fw-semibold">{r.anggota_nama}</td>
                  <td className="mono" style={{ fontSize: 10 }}>{r.nip}</td>
                  <td className="text-end mono fw-bold">{fmtRp(r.terpakai)}</td>
                  <td className="text-end mono text-success">{fmtRp(r.sisa)}</td>
                  <td>
                    <div style={{ background: '#E2E8F0', borderRadius: 4, height: 18, position: 'relative' }}>
                      <div style={{ background: barColor, height: '100%', borderRadius: 4, width: `${pct}%` }} />
                      <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700 }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-end mono text-danger">{r.piutang_now ? fmtRp(r.piutang_now) : '—'}</td>
                  <td>
                    <span className={`bd ${r.status === 'suspend' ? 'bd-red' : 'bd-green'}`}>{r.status}</span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8} className="text-center text-muted py-3">Belum ada data limit bulan ini</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

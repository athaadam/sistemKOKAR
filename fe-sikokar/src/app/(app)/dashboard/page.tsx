'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

export default function DashboardPage() {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<{ data: Record<string, unknown> }>('/dashboard')
      .then((r) => setD(r.data as Record<string, unknown>))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Flash message={err} type="danger" />;
  if (!d) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  const sales = (d.sales_today as { t?: number; c?: number }) || {};
  const cards = [
    { href: '/toko', label: 'Omzet Hari Ini', val: sales.t || 0, sub: `${sales.c || 0} transaksi` },
    { href: '/toko', label: 'Total Omzet', val: (d.total_omzet as { t?: number })?.t || 0, sub: 'akumulasi semua transaksi' },
    { href: '/toko', label: 'Total Promo & Diskon', val: (d.total_promo_diskon as { t?: number })?.t || 0, sub: 'semua potongan' },
    { href: '/toko', label: 'Profit Kotor Hari Ini', val: (d.profit_gross_today as { t?: number })?.t || 0, sub: 'sebelum promo/diskon' },
    { href: '/toko', label: 'Profit Bersih Hari Ini', val: (d.profit_today as { t?: number })?.t || 0, sub: 'setelah promo/diskon' },
    { href: '/toko', label: 'Profit Bersih Bulan Ini', val: (d.profit_month as { t?: number })?.t || 0, sub: 'akumulasi bersih' },
    { href: '/pinjaman', label: 'Outstanding Pinjaman', val: (d.total_pinjaman as { t?: number })?.t || 0, sub: 'aktif' },
    { href: '/simpanan', label: 'Total Simpanan', val: (d.total_simpanan as { t?: number })?.t || 0, sub: '3 jenis' },
    { href: '/anggota', label: 'Anggota Aktif', val: (d.anggota_aktif as { c?: number })?.c || 0, sub: 'terdaftar' },
    { href: '/laporan?tab=pembelian', label: 'Piutang Toko/Pos', val: (d.total_piutang_toko as { t?: number })?.t || 0, sub: 'hutang pembelian' },
    { href: '/ppob', label: 'Fee PPOB', val: (d.fee_ppob as { t?: number })?.t || 0, sub: 'total fee' },
  ];

  const recent = (d.recent_sales as Record<string, unknown>[]) || [];
  const simpanan = (d.simpanan_dict as Record<string, number>) || {};

  return (
    <>
      <h2 className="h5 mb-3">Dashboard Operasional</h2>
      <div className="row g-3 mb-3">
        {cards.map((c) => (
          <div key={c.href} className="col-6 col-lg-3">
            <Link href={c.href} className="stat-card">
              <div className="stat-val">Rp {fmtRp(c.val)}</div>
              <div className="text-muted small">{c.label}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>→ {c.sub}</div>
            </Link>
          </div>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-md-7">
          <div className="card">
            <div className="card-body">
              <div className="fw-bold mb-2">Transaksi Terkini</div>
              {recent.length === 0 && <p className="text-muted small">Belum ada transaksi hari ini</p>}
              {recent.map((r, i) => (
                <div key={i} className="d-flex justify-content-between border-bottom py-2 small">
                  <span>
                    <span className={`badge ${r.jenis === 'kredit' ? 'bg-primary' : 'bg-success'} me-1`}>{String(r.jenis)}</span>
                    {String(r.anggota_nama || 'Umum')}
                  </span>
                  <span className="mono">Rp {fmtRp(Number(r.total))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-md-5">
          <div className="card">
            <div className="card-body">
              <div className="fw-bold mb-2">Ringkasan Simpanan</div>
              {Object.entries(simpanan).map(([jenis, total]) => (
                <div key={jenis} className="d-flex justify-content-between py-1 small">
                  <span className="text-capitalize">{jenis}</span>
                  <span className="mono">Rp {fmtRp(total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

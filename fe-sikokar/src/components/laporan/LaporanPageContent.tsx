'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { ReportExportBar } from '@/components/report/ReportExportBar';
import { IconRenderer, ICON_MAP, type IconConfig } from '@/components/ui/IconRenderer';

const TABS: { id: string; label: string; icon: IconConfig }[] = [
  { id: 'toko', label: 'Penjualan', icon: ICON_MAP.history_custom },
  { id: 'pembelian', label: 'Pembelian', icon: ICON_MAP.pembelian_custom },
  { id: 'stok', label: 'Stok', icon: ICON_MAP.package_custom },
  { id: 'stok_opname', label: 'Stok Opname', icon: ICON_MAP.chartofaccount_custom },
  { id: 'simpanan', label: 'Simpanan', icon: ICON_MAP.simpanan_custom },
  { id: 'pinjaman', label: 'Pinjaman', icon: ICON_MAP.pinjaman_custom },
  { id: 'ppob', label: 'PPOB', icon: ICON_MAP.ppob_custom },
  { id: 'usaha', label: 'Catering/Usaha Lain', icon: ICON_MAP.catering_custom },
  { id: 'kredit', label: 'Kredit Motor/Elek', icon: ICON_MAP.pinjaman_custom },
];

const DATE_TABS = new Set(['toko', 'pembelian', 'ppob', 'usaha']);

type TabData = Record<string, unknown> & {
  rows?: Record<string, unknown>[];
};

function n(v: unknown): number {
  return Number(v) || 0;
}

function rp(v: unknown): string {
  return fmtRp(n(v));
}

function bd(cls: string, text: string) {
  return <span className={`bd ${cls}`}>{text}</span>;
}

function StatCard({
  value,
  label,
  bg,
  border,
  color,
}: {
  value: React.ReactNode;
  label: string;
  bg: string;
  border: string;
  color?: string;
}) {
  return (
    <div className="col-md-3 col-6">
      <div className="p-3 rounded" style={{ background: bg, border: `1px solid ${border}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 12, color: color || border }}>{label}</div>
      </div>
    </div>
  );
}

function TabTable({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
      <table className="table table-sm" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

function renderTabContent(tab: string, data: TabData) {
  const rows = data.rows || [];

  if (tab === 'toko') {
    return (
      <>
        <div className="row g-2 mb-3 no-print">
          <StatCard value={`Rp ${rp(data.total)}`} label="Total Omzet" bg="#EFF6FF" border="#BFDBFE" color="#1D4ED8" />
          <StatCard value={`Rp ${rp(data.omzet_l1)}`} label="KOPMART 1" bg="#DCFCE7" border="#86EFAC" color="#16A34A" />
          <StatCard value={`Rp ${rp(data.omzet_l2)}`} label="KOPMART 2" bg="#FEF3C7" border="#FCD34D" color="#92400E" />
          <StatCard value={rows.length} label="Transaksi" bg="#F5F3FF" border="#C4B5FD" color="#5B21B6" />
        </div>
        <TabTable minWidth={750}>
          <thead>
            <tr>
              <th>No</th><th>Tanggal</th><th>Toko</th><th>Jenis</th><th>Anggota</th>
              <th className="text-end">Subtotal</th><th className="text-end">Diskon</th><th className="text-end">PPN</th><th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="mono" style={{ fontSize: 11 }}>{String(r.no)}</span></td>
                <td style={{ fontSize: 11 }}>{String(r.tgl)}</td>
                <td>{bd('bd-navy', String(r.lokasi_nama || ''))}</td>
                <td>{bd(r.jenis === 'kredit' ? 'bd-amber' : 'bd-green', String(r.jenis))}</td>
                <td style={{ fontSize: 11 }}>{String(r.anggota_nama || '—')}</td>
                <td className="text-end mono">{rp(r.subtotal)}</td>
                <td className="text-end mono text-danger">{n(r.diskon_total) ? rp(r.diskon_total) : '—'}</td>
                <td className="text-end mono text-warning">{n(r.ppn_total) ? rp(r.ppn_total) : '—'}</td>
                <td className="text-end mono fw-bold">{rp(r.total)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="text-center text-muted py-3">Tidak ada data untuk periode ini</td></tr>}
          </tbody>
          {!!rows.length && (
            <tfoot>
              <tr><td colSpan={8} className="text-end fw-bold">TOTAL</td><td className="text-end mono fw-bold">Rp {rp(data.total)}</td></tr>
            </tfoot>
          )}
        </TabTable>
      </>
    );
  }

  if (tab === 'pembelian') {
    return (
      <>
        <div className="mb-2"><b>Total Pembelian: Rp {rp(data.total)}</b> · {rows.length} transaksi</div>
        <TabTable>
          <thead><tr><th>No</th><th>Tanggal</th><th>Supplier</th><th>Toko</th><th className="text-end">Total</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="mono" style={{ fontSize: 11 }}>{String(r.no)}</span></td>
                <td>{String(r.tgl)}</td>
                <td>{String(r.supplier_nama || '—')}</td>
                <td>{bd('bd-navy', String(r.lokasi_nama || ''))}</td>
                <td className="text-end mono fw-bold">Rp {rp(r.total)}</td>
                <td>{bd(r.status === 'lunas' ? 'bd-green' : 'bd-amber', String(r.status))}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="text-center text-muted py-3">Tidak ada data</td></tr>}
          </tbody>
        </TabTable>
      </>
    );
  }

  if (tab === 'stok') {
    return (
      <>
        <div className="mb-2"><b>Nilai Stok Total: Rp {rp(data.total_nilai)}</b></div>
        <TabTable minWidth={700}>
          <thead>
            <tr>
              <th>Kode</th><th>Nama Barang</th><th>Kategori</th><th className="text-end">H. Jual</th>
              <th className="text-end">Stok KM1</th><th className="text-end">Stok KM2</th><th className="text-end">Total Stok</th><th className="text-end">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const total = n(r.total_stok);
              return (
                <tr key={i} className={total < 5 ? 'table-danger' : ''}>
                  <td><span className="mono" style={{ fontSize: 11 }}>{String(r.kode)}</span></td>
                  <td className="fw-semibold">{String(r.nama)}</td>
                  <td style={{ fontSize: 11 }}>{String(r.kategori)}</td>
                  <td className="text-end mono">{rp(r.harga)}</td>
                  <td className={`text-end mono ${n(r.stok_l1) < 5 ? 'text-danger fw-bold' : ''}`}>{Math.trunc(n(r.stok_l1))}</td>
                  <td className={`text-end mono ${n(r.stok_l2) < 5 ? 'text-danger fw-bold' : ''}`}>{Math.trunc(n(r.stok_l2))}</td>
                  <td className="text-end mono fw-semibold">{Math.trunc(total)}</td>
                  <td className="text-end mono">{rp(r.nilai_stok)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={7} className="text-end fw-bold">Total Nilai</td><td className="text-end mono fw-bold">Rp {rp(data.total_nilai)}</td></tr>
          </tfoot>
        </TabTable>
      </>
    );
  }

  if (tab === 'stok_opname') {
    return (
      <>
        <div className="alert alert-info" style={{ fontSize: 12 }}>
          <b>Rekomendasi:</b> gunakan kolom selisih sebagai dasar adjustment. Jika stok fisik lebih kecil dari sistem, cek transaksi penjualan/void dan buat adjustment minus.
          Jika stok fisik lebih besar, cek penerimaan barang dan buat adjustment plus. Semua adjustment sebaiknya disetujui oleh PIC toko dan Accounting.
        </div>
        <TabTable minWidth={950}>
          <thead>
            <tr>
              <th>Kode</th><th>Barang</th><th>Kategori</th><th>Satuan</th><th>Lokasi</th>
              <th className="text-end">Stok Sistem</th><th className="text-end">Stok Fisik</th><th className="text-end">Selisih</th><th>Rekomendasi Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono">{String(r.kode)}</td>
                <td className="fw-semibold">{String(r.nama)}</td>
                <td>{String(r.kategori)}</td>
                <td>{String(r.satuan)}</td>
                <td>{String(r.lokasi)}</td>
                <td className="text-end mono">{Math.trunc(n(r.stok_sistem))}</td>
                <td className="text-end mono">{Math.trunc(n(r.stok_fisik))}</td>
                <td className="text-end mono">{Math.trunc(n(r.selisih))}</td>
                <td>{String(r.rekomendasi)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="text-center text-muted py-3">Belum ada data stok opname</td></tr>}
          </tbody>
        </TabTable>
      </>
    );
  }

  if (tab === 'pinjaman') {
    return (
      <>
        <div className="row g-2 mb-3 no-print">
          <div className="col-md-4">
            <StatCard value={`Rp ${rp(data.outstanding)}`} label="Outstanding" bg="#FEF2F2" border="#FECACA" color="#DC2626" />
          </div>
          <div className="col-md-4">
            <StatCard value={`Rp ${rp(data.angsuran_bln)}`} label="Angsuran/Bulan" bg="#FEF9C3" border="#FDE68A" color="#92400E" />
          </div>
        </div>
        <TabTable minWidth={900}>
          <thead>
            <tr>
              <th>No Pinjaman</th><th>Tgl Pengajuan</th><th>Tgl Cair</th><th>Anggota</th><th>NIP</th><th>Jenis</th>
              <th className="text-end">Nominal</th><th className="text-end">Angsuran/bln</th><th className="text-end">Sisa Pokok</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="mono" style={{ fontSize: 11 }}>{String(r.no)}</span></td>
                <td style={{ fontSize: 11 }}>{String(r.tgl_pengajuan)}</td>
                <td style={{ fontSize: 11 }}>{String(r.tgl_cair || '—')}</td>
                <td className="fw-semibold">{String(r.nama)}</td>
                <td><span className="mono" style={{ fontSize: 10 }}>{String(r.nip)}</span></td>
                <td>{bd(r.jenis === 'darurat' ? 'bd-amber' : 'bd-navy', String(r.jenis))}</td>
                <td className="text-end mono">{rp(r.nominal)}</td>
                <td className="text-end mono">{rp(r.angsuran)}</td>
                <td className={`text-end mono fw-semibold ${n(r.sisa_pokok) > 0 ? 'text-danger' : 'text-success'}`}>{rp(r.sisa_pokok)}</td>
                <td>{bd(r.status === 'lunas' ? 'bd-green' : r.status === 'aktif' ? 'bd-amber' : 'bd-red', String(r.status))}</td>
              </tr>
            ))}
          </tbody>
        </TabTable>
      </>
    );
  }

  if (tab === 'simpanan') {
    return (
      <>
        <div className="mb-2"><b>Total Simpanan: Rp {rp(data.total_all)}</b></div>
        <TabTable>
          <thead>
            <tr><th>No Ang</th><th>NIP</th><th>Nama</th><th>Dept</th><th className="text-end">Pokok</th><th className="text-end">Wajib</th><th className="text-end">Sukarela</th><th className="text-end">Total</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="mono">{String(r.no)}</span></td>
                <td><span className="mono" style={{ fontSize: 10 }}>{String(r.nip)}</span></td>
                <td className="fw-semibold">{String(r.nama)}</td>
                <td style={{ fontSize: 11 }}>{String(r.dept)}</td>
                <td className="text-end mono">{rp(r.pokok)}</td>
                <td className="text-end mono">{rp(r.wajib)}</td>
                <td className="text-end mono">{rp(r.sukarela)}</td>
                <td className="text-end mono fw-bold">{rp(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={7} className="text-end fw-bold">Total</td><td className="text-end mono fw-bold">Rp {rp(data.total_all)}</td></tr>
          </tfoot>
        </TabTable>
      </>
    );
  }

  if (tab === 'ppob') {
    const totalVol = n(data.total_vol) + n(data.total_fee);
    return (
      <>
        <div className="row g-2 mb-3 no-print">
          <StatCard value={`Rp ${rp(data.total_fee)}`} label="Total Fee Diperoleh" bg="#DCFCE7" border="#86EFAC" color="#16A34A" />
          <StatCard value={`Rp ${rp(data.total_vol)}`} label="Total Volume" bg="#EFF6FF" border="#BFDBFE" color="#1D4ED8" />
          <StatCard value={rows.length} label="Transaksi" bg="#F5F3FF" border="#C4B5FD" color="#5B21B6" />
        </div>
        <TabTable>
          <thead><tr><th>No</th><th>Tanggal</th><th>Layanan</th><th>Pelanggan</th><th className="text-end">Nominal</th><th className="text-end">Fee</th><th className="text-end">Total</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="mono" style={{ fontSize: 11 }}>{String(r.no)}</span></td>
                <td>{String(r.tgl)}</td>
                <td>{String(r.layanan)}</td>
                <td>{String(r.pelanggan)}</td>
                <td className="text-end mono">{rp(r.nominal)}</td>
                <td className="text-end mono text-success fw-semibold">{rp(r.fee)}</td>
                <td className="text-end mono fw-bold">{rp(r.total)}</td>
                <td>{bd('bd-green', String(r.status))}</td>
              </tr>
            ))}
          </tbody>
          {!!rows.length && (
            <tfoot>
              <tr>
                <td colSpan={5} className="text-end fw-bold">Total</td>
                <td className="text-end mono fw-bold text-success">Rp {rp(data.total_fee)}</td>
                <td className="text-end mono fw-bold">Rp {rp(totalVol)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </TabTable>
      </>
    );
  }

  if (tab === 'usaha') {
    return (
      <>
        <div className="row g-2 mb-3 no-print">
          <StatCard value={`Rp ${rp(data.total_pendapatan)}`} label="Pendapatan" bg="#DCFCE7" border="#86EFAC" color="#16A34A" />
          <StatCard value={`Rp ${rp(data.total_biaya)}`} label="Biaya" bg="#FEF2F2" border="#FECACA" color="#DC2626" />
          <StatCard value={`Rp ${rp(data.total_laba)}`} label="Laba" bg="#EFF6FF" border="#BFDBFE" color="#1D4ED8" />
        </div>
        <TabTable>
          <thead><tr><th>Tanggal</th><th>Jenis</th><th>Nama Usaha</th><th>Customer</th><th className="text-end">Pendapatan</th><th className="text-end">Biaya</th><th className="text-end">Laba</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{String(r.tgl)}</td>
                <td>{String(r.jenis)}</td>
                <td>{String(r.nama)}</td>
                <td>{String(r.customer)}</td>
                <td className="text-end mono">{rp(r.pendapatan)}</td>
                <td className="text-end mono">{rp(r.biaya)}</td>
                <td className="text-end mono fw-bold">{rp(r.laba)}</td>
                <td>{String(r.status)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="text-center text-muted py-3">Belum ada data usaha lain</td></tr>}
          </tbody>
        </TabTable>
      </>
    );
  }

  if (tab === 'kredit') {
    return (
      <>
        <div className="row g-2 mb-3 no-print">
          <StatCard value={`Rp ${rp(data.motor_outstanding)}`} label="🏍️ Motor Outstanding" bg="#FEF3C7" border="#FCD34D" color="#92400E" />
          <StatCard value={`Rp ${rp(data.elek_outstanding)}`} label="📱 Elektronik Outstanding" bg="#D1FAE5" border="#6EE7B7" color="#065F46" />
          <StatCard value={`Rp ${rp(n(data.motor_angs) + n(data.elek_angs))}`} label="Total Angsuran/Bln" bg="#EFF6FF" border="#BFDBFE" color="#1D4ED8" />
          <StatCard value={rows.length} label="Total Kontrak" bg="#F5F3FF" border="#C4B5FD" color="#5B21B6" />
        </div>
        <TabTable minWidth={950}>
          <thead>
            <tr>
              <th>No Kredit</th><th>Tgl Mulai</th><th>Anggota</th><th>NIP</th><th>Jenis</th><th>Nama Barang</th><th>Toko</th>
              <th className="text-end">Harga Beli</th><th className="text-end">DP</th><th className="text-end">Bunga%</th><th className="text-end">Tenor</th>
              <th className="text-end">Angsuran/bln</th><th className="text-end">Sisa</th><th className="text-center">Cicilan</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.status === 'lunas' ? 'table-success' : ''}>
                <td><span className="mono" style={{ fontSize: 10 }}>{String(r.no)}</span></td>
                <td style={{ fontSize: 11 }}>{String(r.tgl_mulai)}</td>
                <td className="fw-semibold">{String(r.anggota_nama)}</td>
                <td><span className="mono" style={{ fontSize: 10 }}>{String(r.nip)}</span></td>
                <td>{bd(r.jenis === 'motor' ? 'bd-amber' : 'bd-green', `${r.jenis === 'motor' ? '🏍️' : '📱'} ${r.jenis}`)}</td>
                <td>{String(r.nama_barang || '—')}</td>
                <td style={{ fontSize: 11, color: '#64748B' }}>{String(r.toko || '—')}</td>
                <td className="text-end mono">{rp(r.harga_beli)}</td>
                <td className="text-end mono">{rp(r.dp)}</td>
                <td className="text-end">{String(r.bunga_pct)}%</td>
                <td className="text-end">{String(r.tenor)}</td>
                <td className="text-end mono fw-bold">{rp(r.angsuran)}</td>
                <td className="text-end mono text-danger">{rp(r.sisa_pokok)}</td>
                <td className="text-center"><span className="bd bd-gray">{String(r.cicilan_ke)}/{String(r.tenor)}</span></td>
                <td>{bd(r.status === 'lunas' ? 'bd-green' : 'bd-amber', String(r.status))}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={15} className="text-center text-muted py-3">Belum ada data kredit</td></tr>}
          </tbody>
        </TabTable>
      </>
    );
  }

  return null;
}

export function LaporanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'toko';
  const tglFrom = searchParams.get('tgl_from') || '';
  const tglTo = searchParams.get('tgl_to') || '';

  const [data, setData] = useState<TabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [draftFrom, setDraftFrom] = useState(tglFrom);
  const [draftTo, setDraftTo] = useState(tglTo);

  const qs = `tab=${encodeURIComponent(tab)}${tglFrom ? `&tgl_from=${encodeURIComponent(tglFrom)}` : ''}${tglTo ? `&tgl_to=${encodeURIComponent(tglTo)}` : ''}`;
  const exportPath = `/laporan/export?${qs}`;

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ data: TabData }>(`/laporan?${qs}`)
      .then((r) => setData(r.data || {}))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDraftFrom(tglFrom);
    setDraftTo(tglTo);
  }, [tglFrom, tglTo]);

  function goTab(nextTab: string) {
    const p = new URLSearchParams();
    p.set('tab', nextTab);
    if (DATE_TABS.has(nextTab) && tglFrom) p.set('tgl_from', tglFrom);
    if (DATE_TABS.has(nextTab) && tglTo) p.set('tgl_to', tglTo);
    router.push(`/laporan?${p.toString()}`);
  }

  function onFilter(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    p.set('tab', tab);
    if (draftFrom) p.set('tgl_from', draftFrom);
    if (draftTo) p.set('tgl_to', draftTo);
    router.push(`/laporan?${p.toString()}`);
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.laporan_custom} size={24} style={{ marginRight: 8 }} />
            Laporan & Analisis
          </h2>
          <p>Filter data per periode & export</p>
        </div>
        <ReportExportBar exportPath={exportPath} />
      </div>

      <ul className="nav nav-tabs mb-0 no-print" style={{ borderBottom: 'none' }}>
        {TABS.map(({ id, label, icon }) => (
          <li className="nav-item" key={id}>
            <button
              type="button"
              className={`nav-link ${tab === id ? 'active fw-semibold' : ''}`}
              style={{
                fontSize: 12,
                padding: '7px 12px',
                borderRadius: '6px 6px 0 0',
                border: 'none',
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#0F2744' : '#64748B',
              }}
              onClick={() => goTab(id)}
            >
              <span className="d-inline-flex align-items-center gap-1">
                <IconRenderer icon={icon} size={16} />
                {label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '0 8px 8px 8px', padding: 16 }}>
        {DATE_TABS.has(tab) && (
          <form className="toolbar mb-3 no-print d-flex flex-wrap align-items-center gap-2" onSubmit={onFilter}>
            <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Tanggal:</label>
            <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
            <span style={{ fontSize: 12, color: '#94A3B8' }}>s/d</span>
            <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
            <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>Filter</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6 }} onClick={() => router.push(`/laporan?tab=${tab}`)}>Reset</button>
          </form>
        )}

        {data && renderTabContent(tab, data)}

        <div className="no-print mt-3 d-flex gap-2" style={{ fontSize: 12 }}>
          <Link href="/laporan/summary-gaji" className="text-decoration-none">Summary Potongan Gaji →</Link>
          <span className="text-muted">|</span>
          <Link href="/laporan/limit-toko" className="text-decoration-none">Limit Kredit Toko →</Link>
        </div>
      </div>
    </>
  );
}

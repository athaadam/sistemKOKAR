'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, bulanIni, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { ReportExportBar } from '@/components/report/ReportExportBar';
import { Modal } from '@/components/crud/Modal';

type Row = {
  anggota_id: string;
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

type PototongGajiTrx = {
  id: string;
  no: string;
  tgl: string;
  jenis: string;
  nominal: number;
  metode: string;
  lokasi_nama?: string;
  pinjaman_no?: string;
};

type AllTransactionItem = {
  id: string;
  no: string;
  tgl: string;
  jenis_transaksi: 'penjualan' | 'pinjaman_bayar';
  nominal: number;
  anggota_id: string;
  anggota_no: string;
  anggota_nama: string;
  metode: string;
  lokasi_nama?: string;
  pinjaman_no?: string;
};

type AllPototongGajiResponse = {
  rows: AllTransactionItem[];
  tgl_from: string;
  tgl_to: string;
  total: number;
};

type DetailPototongGaji = {
  penjualan: PototongGajiTrx[];
  pinjaman_bayar: PototongGajiTrx[];
  total: number;
};

function n(v: unknown): number {
  return Number(v) || 0;
}

export function SummaryGajiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bulan = searchParams.get('bulan') || bulanIni();
  const tgl_from = searchParams.get('tgl_from') || '';
  const tgl_to = searchParams.get('tgl_to') || '';

  const [rows, setRows] = useState<Row[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [hdr, setHdr] = useState<Hdr>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filterTglFrom, setFilterTglFrom] = useState(tgl_from);
  const [filterTglTo, setFilterTglTo] = useState(tgl_to);
  const [showMonthFilter, setShowMonthFilter] = useState(!tgl_from && !tgl_to);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAnggota, setSelectedAnggota] = useState<Row | null>(null);
  const [detailData, setDetailData] = useState<DetailPototongGaji | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<AllTransactionItem[]>([]);
  const [allTransLoading, setAllTransLoading] = useState(false);
  const [allTransError, setAllTransError] = useState<string>('');

  let exportPath = `/laporan/summary_gaji/export?bulan=${encodeURIComponent(bulan)}`;
  if (filterTglFrom && filterTglTo) {
    exportPath = `/laporan/summary_gaji/export?tgl_from=${filterTglFrom}&tgl_to=${filterTglTo}`;
  }

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    let url = `/laporan/summary_gaji?bulan=${encodeURIComponent(bulan)}`;
    if (filterTglFrom && filterTglTo) {
      url = `/laporan/summary_gaji?tgl_from=${filterTglFrom}&tgl_to=${filterTglTo}`;
    }
    api
      .get<{ rows: Row[]; grand_total: number; hdr: Hdr }>( url)
      .then((r) => {
        setRows(r.rows || []);
        setGrandTotal(n(r.grand_total));
        setHdr(r.hdr || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bulan, filterTglFrom, filterTglTo]);

  useEffect(() => {
    load();
  }, [load]);

  // Load all transactions whenever filters change
  useEffect(() => {
    setAllTransLoading(true);
    setAllTransError('');
    const params = new URLSearchParams();
    if (filterTglFrom && filterTglTo) {
      params.append('tgl_from', filterTglFrom);
      params.append('tgl_to', filterTglTo);
    }
    const endpoint = `/laporan/pototong_gaji/all?${params}`;
    api
      .get<AllPototongGajiResponse>(endpoint)
      .then((result) => {
        setAllTransactions(result.rows || []);
      })
      .catch((e: any) => {
        console.error('Error loading all transactions:', e);
        setAllTransError(e.message || 'Gagal memuat data transaksi');
        setAllTransactions([]);
      })
      .finally(() => setAllTransLoading(false));
  }, [filterTglFrom, filterTglTo]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;

  const logoUrl = hdr.logo ? `/${hdr.logo.replace(/^\/+/, '')}` : null;
  const sum = (key: keyof Row) => rows.reduce((s, r) => s + n(r[key]), 0);

  const handleApplyFilter = () => {
    if (filterTglFrom && filterTglTo) {
      setShowMonthFilter(false);
      router.push(`/laporan/summary-gaji?tgl_from=${filterTglFrom}&tgl_to=${filterTglTo}`);
    }
  };

  const handleResetFilter = () => {
    setFilterTglFrom('');
    setFilterTglTo('');
    setShowMonthFilter(true);
    router.push(`/laporan/summary-gaji?bulan=${bulanIni()}`);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/laporan/summary-gaji?bulan=${e.target.value}`);
  };

  const handleViewDetail = async (row: Row) => {
    setSelectedAnggota(row);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTglFrom && filterTglTo) {
        params.append('tgl_from', filterTglFrom);
        params.append('tgl_to', filterTglTo);
      }
      const result = await api.get<DetailPototongGaji>(`/laporan/pototong_gaji/${row.anggota_id}?${params}`);
      setDetailData(result);
    } catch (e) {
      console.error('Failed to load detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedAnggota(null);
    setDetailData(null);
  };

  return (
    <>
      <div className="pg-hdr no-print">
        <div className="pg-hdr-left">
          <h2>📄 Summary Potongan Gaji</h2>
          <p>
            {filterTglFrom && filterTglTo
              ? `Periode: ${filterTglFrom} s/d ${filterTglTo}`
              : `Periode: ${bulan}`} · {rows.length} anggota
          </p>
        </div>
        <ReportExportBar
          exportPath={exportPath}
          extra={
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  value={filterTglFrom}
                  className="form-control form-control-sm"
                  style={{ width: 140, borderRadius: 6 }}
                  onChange={(e) => setFilterTglFrom(e.target.value)}
                  title="Dari tanggal"
                />
                <span style={{ fontSize: 12, color: '#666' }}>s/d</span>
                <input
                  type="date"
                  value={filterTglTo}
                  className="form-control form-control-sm"
                  style={{ width: 140, borderRadius: 6 }}
                  onChange={(e) => setFilterTglTo(e.target.value)}
                  title="Sampai tanggal"
                />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleApplyFilter}
                  style={{ borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}
                  disabled={!filterTglFrom || !filterTglTo}
                >
                  Terapkan
                </button>
                {(filterTglFrom || filterTglTo) && (
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={handleResetFilter}
                    style={{ borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}
                  >
                    Reset
                  </button>
                )}
                {showMonthFilter && (
                  <input
                    type="month"
                    value={bulan}
                    className="form-control form-control-sm"
                    style={{ width: 160, borderRadius: 6 }}
                    onChange={handleMonthChange}
                    title="Pilih berdasarkan bulan"
                  />
                )}
                <Link href="/laporan" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6, fontSize: 12 }}>
                  ← Laporan
                </Link>
              </div>
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
                <th className="text-end">Total Potongan</th><th style={{ width: 80 }} className="text-center">Aksi</th>
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
                  <td className="text-center">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleViewDetail(r)}
                      title="Lihat detail potong gaji"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      📋
                    </button>
                  </td>
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

      {/* Semua Transaksi Potong Gaji Section - Separated by Type */}
      <div className="p-3 mt-4" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
        <h5 style={{ color: '#0F2744', fontWeight: 'bold', marginBottom: 16 }}>
          📊 SEMUA TRANSAKSI POTONG GAJI
        </h5>

        {allTransError && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {allTransError}
          </div>
        )}

        {allTransLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border spinner-border-sm" />
            <p className="text-muted mt-2">Memuat data transaksi...</p>
          </div>
        ) : allTransactions.length > 0 ? (
          <>
            {/* Penjualan / Belanja Toko */}
            {allTransactions.filter((t) => t.jenis_transaksi === 'penjualan').length > 0 && (
              <div className="mb-5">
                <h6 style={{ color: '#0F2744', fontWeight: 'bold', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #0F2744' }}>
                  🛒 TRANSAKSI PENJUALAN (Potong Gaji)
                </h6>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-sm table-bordered" style={{ fontSize: 11, marginBottom: 0 }}>
                    <thead style={{ background: '#E8F4F8' }}>
                      <tr>
                        <th style={{ width: 80 }}>Tgl</th>
                        <th style={{ width: 100 }}>No</th>
                        <th>Anggota</th>
                        <th style={{ width: 120 }}>Metode</th>
                        <th style={{ width: 100 }}>Lokasi</th>
                        <th className="text-end" style={{ width: 100 }}>Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions
                        .filter((t) => t.jenis_transaksi === 'penjualan')
                        .map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.tgl}</td>
                            <td style={{ fontSize: 10 }}>{item.no}</td>
                            <td>
                              <div style={{ fontSize: 11, fontWeight: 'bold' }}>{item.anggota_nama}</div>
                              <div style={{ fontSize: 10, color: '#888' }}>({item.anggota_no})</div>
                            </td>
                            <td style={{ fontSize: 10 }}>{item.metode}</td>
                            <td style={{ fontSize: 10 }}>{item.lokasi_nama || '-'}</td>
                            <td className="text-end" style={{ fontWeight: 'bold', color: '#0F2744' }}>
                              {fmtRp(item.nominal)}
                            </td>
                          </tr>
                        ))}
                      <tr style={{ background: '#E8F4F8', fontWeight: 'bold' }}>
                        <td colSpan={5} className="text-end">
                          SUBTOTAL PENJUALAN:
                        </td>
                        <td className="text-end" style={{ color: '#0F2744' }}>
                          {fmtRp(
                            allTransactions
                              .filter((t) => t.jenis_transaksi === 'penjualan')
                              .reduce((s, r) => s + Number(r.nominal || 0), 0)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pembayaran Pinjaman */}
            {allTransactions.filter((t) => t.jenis_transaksi === 'pinjaman_bayar').length > 0 && (
              <div className="mb-5">
                <h6 style={{ color: '#0F2744', fontWeight: 'bold', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #0F2744' }}>
                  💰 TRANSAKSI PEMBAYARAN PINJAMAN (Potong Gaji)
                </h6>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-sm table-bordered" style={{ fontSize: 11, marginBottom: 0 }}>
                    <thead style={{ background: '#E8F4F8' }}>
                      <tr>
                        <th style={{ width: 80 }}>Tgl</th>
                        <th style={{ width: 100 }}>No Pinjaman</th>
                        <th>Anggota</th>
                        <th style={{ width: 120 }}>Metode</th>
                        <th style={{ width: 100 }}>Ref Pinjaman</th>
                        <th className="text-end" style={{ width: 100 }}>Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions
                        .filter((t) => t.jenis_transaksi === 'pinjaman_bayar')
                        .map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.tgl}</td>
                            <td style={{ fontSize: 10 }}>{item.pinjaman_no || '-'}</td>
                            <td>
                              <div style={{ fontSize: 11, fontWeight: 'bold' }}>{item.anggota_nama}</div>
                              <div style={{ fontSize: 10, color: '#888' }}>({item.anggota_no})</div>
                            </td>
                            <td style={{ fontSize: 10 }}>{item.metode}</td>
                            <td style={{ fontSize: 10 }}>{item.pinjaman_no || '-'}</td>
                            <td className="text-end" style={{ fontWeight: 'bold', color: '#0F2744' }}>
                              {fmtRp(item.nominal)}
                            </td>
                          </tr>
                        ))}
                      <tr style={{ background: '#E8F4F8', fontWeight: 'bold' }}>
                        <td colSpan={5} className="text-end">
                          SUBTOTAL PEMBAYARAN PINJAMAN:
                        </td>
                        <td className="text-end" style={{ color: '#0F2744' }}>
                          {fmtRp(
                            allTransactions
                              .filter((t) => t.jenis_transaksi === 'pinjaman_bayar')
                              .reduce((s, r) => s + Number(r.nominal || 0), 0)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div style={{ background: '#F5F5F5', padding: 16, borderRadius: 6, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 'bold', color: '#0F2744', fontSize: 14 }}>
                  TOTAL SEMUA TRANSAKSI POTONG GAJI:
                </span>
                <span style={{ fontSize: 18, fontWeight: 'bold', color: '#0F2744' }}>
                  {fmtRp(allTransactions.reduce((s, r) => s + Number(r.nominal || 0), 0))}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {allTransactions.filter((t) => t.jenis_transaksi === 'penjualan').length} transaksi penjualan +{' '}
                {allTransactions.filter((t) => t.jenis_transaksi === 'pinjaman_bayar').length} transaksi pembayaran pinjaman
              </div>
            </div>
          </>
        ) : (
          <div className="alert alert-info" style={{ marginBottom: 0 }}>
            Tidak ada transaksi potong gaji untuk periode ini.
          </div>
        )}
      </div>

      {selectedAnggota && (
        <Modal
          open={showDetailModal}
          title={`Detail Potong Gaji - ${selectedAnggota.nama} (${selectedAnggota.no})`}
          onClose={handleCloseDetail}
          size="lg"
        >
          {detailLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm" />
            </div>
          ) : detailData ? (
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {detailData.penjualan.length > 0 && (
                <div className="mb-4">
                  <h6 style={{ color: '#0F2744', fontWeight: 'bold', marginBottom: 8 }}>Transaksi Penjualan (Potong Gaji)</h6>
                  <table className="table table-sm table-bordered" style={{ fontSize: 12, marginBottom: 0 }}>
                    <thead style={{ background: '#E8F4F8' }}>
                      <tr>
                        <th>Tgl</th>
                        <th>No</th>
                        <th>Lokasi</th>
                        <th className="text-end">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.penjualan.map((item, idx) => (
                        <tr key={`pj-${idx}`}>
                          <td>{item.tgl}</td>
                          <td>{item.no}</td>
                          <td>{item.lokasi_nama || '-'}</td>
                          <td className="text-end">{fmtRp(item.nominal)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#F0F0F0', fontWeight: 'bold' }}>
                        <td colSpan={3} className="text-end">Subtotal:</td>
                        <td className="text-end">{fmtRp(detailData.penjualan.reduce((s, r) => s + Number(r.nominal || 0), 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {detailData.pinjaman_bayar.length > 0 && (
                <div className="mb-4">
                  <h6 style={{ color: '#0F2744', fontWeight: 'bold', marginBottom: 8 }}>Transaksi Pembayaran Pinjaman (Potong Gaji)</h6>
                  <table className="table table-sm table-bordered" style={{ fontSize: 12, marginBottom: 0 }}>
                    <thead style={{ background: '#E8F4F8' }}>
                      <tr>
                        <th>Tgl</th>
                        <th>No Pinjaman</th>
                        <th>Metode</th>
                        <th className="text-end">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.pinjaman_bayar.map((item, idx) => (
                        <tr key={`pb-${idx}`}>
                          <td>{item.tgl}</td>
                          <td>{item.pinjaman_no || '-'}</td>
                          <td>{item.metode}</td>
                          <td className="text-end">{fmtRp(item.nominal)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#F0F0F0', fontWeight: 'bold' }}>
                        <td colSpan={3} className="text-end">Subtotal:</td>
                        <td className="text-end">{fmtRp(detailData.pinjaman_bayar.reduce((s, r) => s + Number(r.nominal || 0), 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {detailData.penjualan.length === 0 && detailData.pinjaman_bayar.length === 0 && (
                <div className="alert alert-info">Tidak ada transaksi potong gaji untuk anggota ini pada periode ini.</div>
              )}

              {(detailData.penjualan.length > 0 || detailData.pinjaman_bayar.length > 0) && (
                <div style={{ background: '#F5F5F5', padding: 12, borderRadius: 6, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#0F2744' }}>TOTAL POTONG GAJI:</span>
                    <span style={{ fontSize: 18, fontWeight: 'bold', color: '#0F2744' }}>{fmtRp(detailData.total)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="alert alert-danger">Gagal memuat data detail</div>
          )}
        </Modal>
      )}
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

const IN_LABELS: Record<string, string> = {
  toko: 'Toko / Penjualan',
  cicilan: 'Cicilan Pinjaman',
  simpanan: 'Setor Simpanan',
  ppob: 'PPOB',
  rental: 'Rental',
  labor: 'Labor',
};

const OUT_LABELS: Record<string, string> = {
  pembelian: 'Pembelian Barang',
  pinjaman: 'Pencairan Pinjaman',
  gaji: 'Beban Gaji',
  ops: 'Beban Operasional',
  lain: 'Beban Lain-lain',
};

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

export function PembukuanArusKasPageContent() {
  const searchParams = useSearchParams();
  const [tahun, setTahun] = useState(searchParams.get('tahun') || today().slice(0, 4));
  const [opIn, setOpIn] = useState<Record<string, number>>({});
  const [opOut, setOpOut] = useState<Record<string, number>>({});
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [net, setNet] = useState(0);
  const [saldoAkhir, setSaldoAkhir] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{
        op_in: Record<string, number>;
        op_out: Record<string, number>;
        saldo_awal: number;
        total_in: number;
        total_out: number;
        net: number;
        saldo_akhir: number;
      }>(`/pembukuan/arus_kas?tahun=${tahun}`)
      .then((r) => {
        setOpIn(r.op_in || {});
        setOpOut(r.op_out || {});
        setSaldoAwal(Number(r.saldo_awal) || 0);
        setTotalIn(Number(r.total_in) || 0);
        setTotalOut(Number(r.total_out) || 0);
        setNet(Number(r.net) || 0);
        setSaldoAkhir(Number(r.saldo_akhir) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => {
    load();
  }, [load]);

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
          <h2>💸 Laporan Arus Kas</h2>
          <p>
            Tahun {tahun} · Saldo Akhir: <b>Rp {fmtRp(saldoAkhir)}</b>
          </p>
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
      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border" />
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-md-6">
            <div className="card" style={{ borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#16A34A', color: '#fff', padding: '8px 14px', fontWeight: 700 }}>KAS MASUK</div>
              <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                <tbody>
                  {Object.entries(opIn).map(([k, v]) => (
                    <tr key={k}>
                      <td>{IN_LABELS[k] || k}</td>
                      <td className="text-end mono">{fmtRp(Number(v))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#DCFCE7', fontWeight: 'bold' }}>
                    <td>TOTAL KAS MASUK</td>
                    <td className="text-end mono">Rp {fmtRp(totalIn)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card" style={{ borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#DC2626', color: '#fff', padding: '8px 14px', fontWeight: 700 }}>KAS KELUAR</div>
              <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                <tbody>
                  {Object.entries(opOut).map(([k, v]) => (
                    <tr key={k}>
                      <td>{OUT_LABELS[k] || k}</td>
                      <td className="text-end mono">{fmtRp(Number(v))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#FEE2E2', fontWeight: 'bold' }}>
                    <td>TOTAL KAS KELUAR</td>
                    <td className="text-end mono">Rp {fmtRp(totalOut)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-12">
            <div className="card" style={{ borderRadius: 8, background: '#F8FAFF' }}>
              <table className="table table-sm mb-0" style={{ fontSize: 13 }}>
                <tbody>
                  <tr>
                    <td className="ps-3">Saldo Awal Tahun</td>
                    <td className="text-end mono">Rp {fmtRp(saldoAwal)}</td>
                  </tr>
                  <tr>
                    <td className="ps-3">Arus Kas Bersih</td>
                    <td className="text-end mono fw-bold" style={{ color: net >= 0 ? '#16A34A' : '#DC2626' }}>
                      {net >= 0 ? '+' : ''}Rp {fmtRp(net)}
                    </td>
                  </tr>
                  <tr style={{ background: '#0F2744', color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                    <td className="ps-3">SALDO AKHIR TAHUN</td>
                    <td className="text-end mono pe-3">Rp {fmtRp(saldoAkhir)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

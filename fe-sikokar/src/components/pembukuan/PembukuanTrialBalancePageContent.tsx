'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type TbRow = { akun: string; debit: number; kredit: number; saldo: number; saldo_debit: number; saldo_kredit: number };

export function PembukuanTrialBalancePageContent() {
  const [rows, setRows] = useState<TbRow[]>([]);
  const [tglTo, setTglTo] = useState(today());
  const [filterTo, setFilterTo] = useState(today());
  const [totalD, setTotalD] = useState(0);
  const [totalK, setTotalK] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: TbRow[]; total_d: number; total_k: number }>(`/pembukuan/trial_balance?tgl_to=${filterTo}`)
      .then((r) => {
        setRows(r.rows || []);
        setTotalD(Number(r.total_d) || 0);
        setTotalK(Number(r.total_k) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterTo]);

  useEffect(() => {
    load();
  }, [load]);

  const balanced = Math.abs(totalD - totalK) < 1;

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
          <h2>📋 Neraca Saldo</h2>
          <p>Trial balance per tanggal</p>
        </div>
      </div>
      <form
        className="toolbar no-print mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilterTo(tglTo);
        }}
      >
        <label>Sampai tanggal:</label>
        <input type="date" value={tglTo} onChange={(e) => setTglTo(e.target.value)} className="form-control form-control-sm" style={{ width: 160 }} />
        <button type="submit" className="btn btn-sm btn-navy">
          Tampilkan
        </button>
      </form>
      {!balanced && rows.length > 0 && (
        <div className="alert alert-warning">Neraca saldo tidak seimbang — selisih Rp {fmtRp(Math.abs(totalD - totalK))}</div>
      )}
      {balanced && rows.length > 0 && <div className="alert alert-success">Neraca saldo seimbang ✓</div>}
      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" />
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="table table-sm" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>Akun</th>
                <th className="text-end">Debit</th>
                <th className="text-end">Kredit</th>
                <th className="text-end">Saldo Debit</th>
                <th className="text-end">Saldo Kredit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.akun}>
                  <td className="fw-semibold">{r.akun}</td>
                  <td className="text-end mono">{fmtRp(r.debit)}</td>
                  <td className="text-end mono">{fmtRp(r.kredit)}</td>
                  <td className="text-end mono">{r.saldo_debit ? fmtRp(r.saldo_debit) : '—'}</td>
                  <td className="text-end mono">{r.saldo_kredit ? fmtRp(r.saldo_kredit) : '—'}</td>
                </tr>
              ))}
              <tr style={{ background: '#F1F5F9', fontWeight: 700 }}>
                <td>TOTAL</td>
                <td className="text-end mono">{fmtRp(totalD)}</td>
                <td className="text-end mono">{fmtRp(totalK)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

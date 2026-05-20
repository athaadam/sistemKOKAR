'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type LedgerRow = {
  no: string;
  tgl: string;
  modul: string;
  ket: string;
  debit_amt: number;
  kredit_amt: number;
  saldo: number;
};

export function PembukuanLedgerPageContent() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [akunList, setAkunList] = useState<{ akun: string }[]>([]);
  const [akun, setAkun] = useState('');
  const [tglFrom, setTglFrom] = useState(`${today().slice(0, 4)}-01-01`);
  const [tglTo, setTglTo] = useState(today());
  const [filterAkun, setFilterAkun] = useState('');
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalKredit, setTotalKredit] = useState(0);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!filterAkun) {
      setRows([]);
      return;
    }
    setLoading(true);
    setErr('');
    const params = new URLSearchParams({ akun: filterAkun, tgl_from: tglFrom, tgl_to: tglTo });
    api
      .get<{ rows: LedgerRow[]; akun_list: { akun: string }[]; total_debit: number; total_kredit: number; saldo: number }>(
        `/pembukuan/ledger?${params}`,
      )
      .then((r) => {
        setRows(r.rows || []);
        setAkunList(r.akun_list || []);
        setTotalDebit(Number(r.total_debit) || 0);
        setTotalKredit(Number(r.total_kredit) || 0);
        setSaldo(Number(r.saldo) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterAkun, tglFrom, tglTo]);

  useEffect(() => {
    api.get<{ akun_list: { akun: string }[] }>('/pembukuan/ledger').then((r) => setAkunList(r.akun_list || []));
  }, []);

  useEffect(() => {
    if (filterAkun) load();
  }, [filterAkun, load]);

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
          <h2>📚 Buku Besar</h2>
          <p>Rincian transaksi per akun</p>
        </div>
      </div>
      <form
        className="toolbar no-print mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilterAkun(akun);
        }}
      >
        <label>Akun:</label>
        <select value={akun} onChange={(e) => setAkun(e.target.value)} className="form-select form-select-sm" style={{ width: 240 }}>
          <option value="">-- Pilih Akun --</option>
          {akunList.map((a) => (
            <option key={a.akun} value={a.akun}>
              {a.akun}
            </option>
          ))}
        </select>
        <input type="date" value={tglFrom} onChange={(e) => setTglFrom(e.target.value)} className="form-control form-control-sm" />
        <input type="date" value={tglTo} onChange={(e) => setTglTo(e.target.value)} className="form-control form-control-sm" />
        <button type="submit" className="btn btn-sm btn-navy">
          Tampilkan
        </button>
      </form>
      {filterAkun && (
        <>
          <div className="d-flex gap-3 mb-3" style={{ fontSize: 13 }}>
            <div className="p-2 rounded" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              Total Debit: <b>Rp {fmtRp(totalDebit)}</b>
            </div>
            <div className="p-2 rounded" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              Total Kredit: <b>Rp {fmtRp(totalKredit)}</b>
            </div>
            <div className="p-2 rounded" style={{ background: '#DCFCE7', border: '1px solid #86EFAC' }}>
              Saldo Akhir: <b>Rp {fmtRp(saldo)}</b>
            </div>
          </div>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm" />
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="table table-sm" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Tgl</th>
                    <th>No</th>
                    <th>Modul</th>
                    <th>Keterangan</th>
                    <th className="text-end">Debit</th>
                    <th className="text-end">Kredit</th>
                    <th className="text-end">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-3">
                        Tidak ada transaksi
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.tgl}</td>
                        <td className="mono" style={{ fontSize: 10 }}>
                          {r.no}
                        </td>
                        <td>
                          <span className="bd bd-gray">{r.modul}</span>
                        </td>
                        <td>{r.ket}</td>
                        <td className="text-end mono">{r.debit_amt ? fmtRp(r.debit_amt) : '—'}</td>
                        <td className="text-end mono">{r.kredit_amt ? fmtRp(r.kredit_amt) : '—'}</td>
                        <td className="text-end mono fw-bold">{fmtRp(r.saldo)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {!filterAkun && <div className="alert alert-info">Pilih akun untuk melihat buku besar</div>}
    </>
  );
}

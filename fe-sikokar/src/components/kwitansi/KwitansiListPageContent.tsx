'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type Kwitansi = {
  id: string;
  no: string;
  tipe: string;
  tgl: string;
  penerima: string;
  perusahaan: string;
  total: number;
  status: string;
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function KwitansiListPageContent() {
  const [rows, setRows] = useState<Kwitansi[]>([]);
  const [totalMonth, setTotalMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'danger'>('success');
  const [tipe, setTipe] = useState('');
  const [q, setQ] = useState('');
  const [appliedTipe, setAppliedTipe] = useState('');
  const [appliedQ, setAppliedQ] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: Kwitansi[]; tot_bln: number }>(
        `/kwitansi?${new URLSearchParams({
          ...(appliedTipe ? { tipe: appliedTipe } : {}),
          ...(appliedQ ? { q: appliedQ } : {}),
        }).toString()}`,
      )
      .then((r) => {
        setRows(r.rows || []);
        setTotalMonth(Number(r.tot_bln) || 0);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [appliedTipe, appliedQ]);

  useEffect(() => {
    load();
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedTipe(tipe);
    setAppliedQ(q);
  }

  async function onDelete(row: Kwitansi) {
    if (!confirm(`Hapus ${row.no}?`)) return;
    try {
      const r = await api.delete<{ message?: string }>(`/kwitansi/delete/${row.id}`);
      setFlash(r.message || 'Kwitansi dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  async function onMarkPaid(row: Kwitansi) {
    if (!confirm(`Tandai ${row.no} sebagai lunas?`)) return;
    try {
      const r = await api.get<{ message?: string }>(`/kwitansi/lunas/${row.id}`);
      setFlash(r.message || 'Ditandai lunas');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal update');
      setFlashType('danger');
    }
  }

  if (loading && !rows.length && !err) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <>
      {err && <Flash message={err} type="danger" />}
      {flash && <Flash message={flash} type={flashType} onClose={() => setFlash('')} />}

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>🧾 Kwitansi & Invoice</h2>
          <p>
            {rows.length} dokumen · Bulan ini: <b>Rp {fmtRp(totalMonth)}</b>
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <a
            href={api.exportUrl('/kwitansi/export?fmt=xlsx')}
            className="btn btn-sm btn-outline-success"
            style={btnStyle}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-file-earmark-excel me-1" />
            Excel
          </a>
          <Link href="/kwitansi/new" className="btn btn-sm btn-navy" style={btnStyle}>
            <i className="bi bi-plus-lg me-1" />
            Buat Kwitansi / Invoice
          </Link>
        </div>
      </div>

      <form className="toolbar no-print d-flex gap-2 mb-3 flex-wrap" onSubmit={onSearch}>
        <select
          className="form-select form-select-sm"
          value={tipe}
          onChange={(e) => setTipe(e.target.value)}
          style={{ width: 145, borderRadius: 6 }}
        >
          <option value="">Semua Tipe</option>
          <option value="kwitansi">Kwitansi</option>
          <option value="invoice">Invoice</option>
        </select>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="No / Penerima..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 200, borderRadius: 6 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={btnStyle}>
          <i className="bi bi-search me-1" />
          Cari
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          style={btnStyle}
          onClick={() => {
            setTipe('');
            setQ('');
            setAppliedTipe('');
            setAppliedQ('');
          }}
        >
          Reset
        </button>
      </form>

      <div className="tbl-wrap tbl-scroll-x">
        <table className="table table-sm" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th>No</th>
              <th>Tipe</th>
              <th>Tanggal</th>
              <th>Penerima</th>
              <th>Perusahaan</th>
              <th className="text-end">Total</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  Belum ada kwitansi / invoice
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="mono fw-semibold" style={{ fontSize: 11 }}>
                      {row.no}
                    </span>
                  </td>
                  <td>
                    {row.tipe === 'invoice' ? (
                      <span className="bd bd-blue">📄 Invoice</span>
                    ) : (
                      <span className="bd bd-gray">🧾 Kwitansi</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>{row.tgl}</td>
                  <td className="fw-semibold">{row.penerima}</td>
                  <td style={{ fontSize: 11, color: '#64748B' }}>{row.perusahaan || '—'}</td>
                  <td className="text-end mono fw-bold">{fmtRp(row.total)}</td>
                  <td>
                    <span className={`bd ${row.status === 'lunas' ? 'bd-green' : 'bd-amber'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="no-print">
                    <Link
                      href={`/kwitansi/${row.id}`}
                      className="btn btn-act btn-outline-primary"
                      target="_blank"
                      title="Print"
                    >
                      <i className="bi bi-printer" />
                    </Link>
                    {row.status !== 'lunas' && (
                      <button
                        type="button"
                        className="btn btn-act btn-outline-success"
                        onClick={() => onMarkPaid(row)}
                        title="Lunas"
                      >
                        <i className="bi bi-check-circle" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-act btn-outline-danger"
                      onClick={() => onDelete(row)}
                      title="Hapus"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

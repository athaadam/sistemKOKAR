'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type PpobService = { id: string; label: string; icon: string; fee: number; jenis: string };
type PpobRow = {
  id: string;
  no: string;
  tgl: string;
  layanan: string;
  pelanggan: string;
  nominal: number;
  fee: number;
  total: number;
  status: string;
};
type Rekap = { vol?: number; fee_total?: number; cnt?: number };

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function PpobPageContent() {
  const [rows, setRows] = useState<PpobRow[]>([]);
  const [services, setServices] = useState<PpobService[]>([]);
  const [rekap, setRekap] = useState<Rekap>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [q, setQ] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterQ, setFilterQ] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams();
    if (filterFrom) params.set('tgl_from', filterFrom);
    if (filterTo) params.set('tgl_to', filterTo);
    if (filterQ) params.set('q', filterQ);
    const qs = params.toString() ? `?${params}` : '';
    api
      .get<{ rows: PpobRow[]; services: PpobService[]; rekap: Rekap }>(`/ppob${qs}`)
      .then((r) => {
        setRows(r.rows || []);
        setServices(r.services || []);
        setRekap(r.rekap || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterFrom, filterTo, filterQ]);

  useEffect(() => {
    load();
  }, [load]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    setFilterFrom(tglFrom);
    setFilterTo(tglTo);
    setFilterQ(q);
  }

  if (loading && !rows.length && !services.length && !err) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <>
      {err && <Flash message={err} type="danger" />}

      <div className="alert alert-secondary mb-3" style={{ fontSize: 13 }}>
        <strong>Fitur PPOB ditutup.</strong> Layanan ditampilkan untuk referensi; transaksi baru tidak dapat diproses.
        Riwayat dan struk transaksi lama tetap dapat dilihat.
      </div>

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.ppob_custom} size={24} style={{ marginRight: 8 }} />
            PPOB — Pembayaran Online
          </h2>
          <p>
            Total Fee: <b>Rp {fmtRp(rekap.fee_total)}</b> · Volume: Rp {fmtRp(rekap.vol)} · {rekap.cnt || 0}{' '}
            transaksi
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <a
            href={api.exportUrl('/ppob/export?fmt=xlsx')}
            className="btn btn-sm btn-outline-success"
            style={btnStyle}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-file-earmark-excel me-1" />
            Excel
          </a>
          <a
            href={api.exportUrl('/ppob/export?fmt=csv')}
            className="btn btn-sm btn-outline-secondary"
            style={btnStyle}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-download me-1" />
            Export
          </a>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748B', marginBottom: 8 }}>
        Pilih Layanan
      </div>
      <div className="row g-2 mb-4">
        {services.map((svc) => (
          <div className="col-6 col-md-3 col-lg-2" key={svc.id}>
            <div
              className="card h-100"
              style={{
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                textAlign: 'center',
                opacity: 0.65,
                cursor: 'not-allowed',
              }}
              title="Fitur PPOB ditutup"
            >
              <div className="card-body p-3">
                <div style={{ fontSize: 26, marginBottom: 6 }}>{svc.icon}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>{svc.label}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>Fee: Rp {fmtRp(svc.fee)}</div>
                <div className="badge bg-secondary mt-2" style={{ fontSize: 9 }}>
                  Ditutup
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="toolbar no-print" onSubmit={onFilter}>
        <input
          type="date"
          value={tglFrom}
          onChange={(e) => setTglFrom(e.target.value)}
          className="form-control form-control-sm"
          style={{ width: 150, borderRadius: 6 }}
        />
        <input
          type="date"
          value={tglTo}
          onChange={(e) => setTglTo(e.target.value)}
          className="form-control form-control-sm"
          style={{ width: 150, borderRadius: 6 }}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari no pelanggan, layanan..."
          className="form-control form-control-sm"
          style={{ width: 240, borderRadius: 6 }}
        />
        <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>
          Filter
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          style={{ borderRadius: 6 }}
          onClick={() => {
            setTglFrom('');
            setTglTo('');
            setQ('');
            setFilterFrom('');
            setFilterTo('');
            setFilterQ('');
          }}
        >
          Reset
        </button>
      </form>

      <div className="tbl-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>No Transaksi</th>
              <th>Tanggal</th>
              <th>Layanan</th>
              <th>No Pelanggan</th>
              <th>Nominal</th>
              <th>Fee</th>
              <th>Total Bayar</th>
              <th>Status</th>
              <th className="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted py-4">
                  Belum ada transaksi
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {r.no}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{r.tgl}</td>
                  <td>
                    <span className="bd bd-blue">{r.layanan}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {r.pelanggan}
                    </span>
                  </td>
                  <td>
                    <span className="mono">Rp {fmtRp(r.nominal)}</span>
                  </td>
                  <td>
                    <span className="mono text-success">+Rp {fmtRp(r.fee)}</span>
                  </td>
                  <td>
                    <span className="mono fw-semibold">Rp {fmtRp(r.total)}</span>
                  </td>
                  <td>
                    <span className="bd bd-green">{r.status}</span>
                  </td>
                  <td className="no-print">
                    <Link href={`/ppob/struk/${r.id}`} target="_blank" className="btn btn-sm btn-outline-info">
                      Struk
                    </Link>
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

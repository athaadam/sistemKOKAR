'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type JasaHistory = {
  no: string;
  periode: string;
  anggota_nama: string;
  anggota_no: string;
  saldo_rata: number;
  rate_pct: number;
  jasa: number;
  tgl: string;
};

export function JasaSimpananPageContent() {
  const [history, setHistory] = useState<JasaHistory[]>([]);
  const [rate, setRate] = useState(3);
  const [periode, setPeriode] = useState(today().slice(0, 4));
  const [rateInput, setRateInput] = useState('3');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ history: JasaHistory[]; rate: number }>('/simpanan/jasa')
      .then((r) => {
        setHistory(r.history || []);
        const defaultRate = Number(r.rate) || 3;
        setRate(defaultRate);
        setRateInput(String(defaultRate));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDistribusi(e: FormEvent) {
    e.preventDefault();
    const ratePct = Number(rateInput) || rate;
    if (
      !confirm(
        'Distribusikan hasil jasa simpanan ke semua anggota aktif?\n\nHasil ini dicatat sebagai transaksi simpanan sukarela, bukan SHU.',
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ message?: string; count?: number }>('/simpanan/jasa', {
        periode,
        rate_pct: ratePct,
      });
      setFlash(r.message || 'Hasil jasa simpanan berhasil dibukukan');
      setFlashType('success');
      load();
    } catch (ex) {
          setFlash(ex instanceof Error ? ex.message : 'Gagal membukukan hasil jasa');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !history.length) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <>
      <Flash message={flash} type={flashType} onClose={() => setFlash('')} />
      {err && <Flash message={err} type="danger" />}

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.jasaSimpanan_custom} size={24} style={{ marginRight: 8 }} />
            Hasil Jasa Simpanan
          </h2>
          <p>
            Hasil atas simpanan sukarela anggota, dicatat sebagai transaksi simpanan dan terpisah dari SHU. Rate default: <b>{rate}%/tahun</b>
          </p>
        </div>
      </div>

      <div className="card mb-3" style={{ borderRadius: 8 }}>
        <div className="card-header" style={{ background: '#0F2744', color: '#fff', fontWeight: 700 }}>
          Pembukuan Hasil Jasa Simpanan
        </div>
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={onDistribusi}>
            <div className="col-md-3">
              <label className="fl">Periode</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                placeholder="YYYY"
                required
              />
            </div>
            <div className="col-md-3">
              <label className="fl">Rate hasil (%)</label>
              <input
                type="number"
                step={0.1}
                className="form-control form-control-sm"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                required
              />
            </div>
            <div className="col-md-3">
              <button type="submit" className="btn btn-sm btn-navy w-100" disabled={saving}>
                {saving ? 'Memproses...' : 'Buku Hasil'}
              </button>
            </div>
          </form>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
            Jasa dihitung dari saldo simpanan sukarela × rate%. Hasil dibukukan sebagai transaksi simpanan, bukan SHU.
          </div>
        </div>
      </div>

      <h6>Riwayat Hasil Jasa Simpanan</h6>
      <div className="tbl-wrap">
        <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>No</th>
              <th>Periode</th>
              <th>Anggota</th>
              <th className="text-end">Saldo Dasar</th>
              <th>Rate</th>
              <th className="text-end">Jasa</th>
              <th>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-3">
                  Belum ada distribusi jasa
                </td>
              </tr>
            ) : (
              history.map((h) => (
                <tr key={h.no}>
                  <td className="mono" style={{ fontSize: 10 }}>
                    {h.no}
                  </td>
                  <td>{h.periode}</td>
                  <td className="fw-semibold">
                    {h.anggota_nama}{' '}
                    <span className="mono" style={{ fontSize: 9, color: '#94A3B8' }}>
                      {h.anggota_no}
                    </span>
                  </td>
                  <td className="text-end mono">{fmtRp(h.saldo_rata)}</td>
                  <td className="text-end">{h.rate_pct}%</td>
                  <td className="text-end mono fw-bold text-success">{fmtRp(h.jasa)}</td>
                  <td style={{ fontSize: 10 }}>{h.tgl}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

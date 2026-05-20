'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today, bulanIni } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type PinMini = { id: string; jenis?: string; angsuran?: number };

type KolektifRow = {
  anggota_id: string;
  no: string;
  nip?: string;
  nama: string;
  dept?: string;
  no_rek?: string;
  nama_bank?: string;
  pinjaman: PinMini[];
  total_angsuran: number;
  sm_pokok: number;
  sm_wajib: number;
  sm_sukarela: number;
  total_simpanan: number;
  total_toko: number;
  total_kredit: number;
  tunggakan: number;
  total_potong: number;
};

type Grand = {
  total_angsuran: number;
  total_simpanan: number;
  total_toko: number;
  total_kredit: number;
  tunggakan: number;
  total_potong: number;
};

type RowState = {
  selected: boolean;
  sm_pokok: number;
  sm_wajib: number;
  sm_sukarela: number;
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

export function PinjamanKolektifPageContent() {
  const [rows, setRows] = useState<KolektifRow[]>([]);
  const [grand, setGrand] = useState<Grand>({
    total_angsuran: 0,
    total_simpanan: 0,
    total_toko: 0,
    total_kredit: 0,
    tunggakan: 0,
    total_potong: 0,
  });
  const [bulan, setBulan] = useState(bulanIni());
  const [tgl, setTgl] = useState(today());
  const [metode, setMetode] = useState('potong-gaji');
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const initRows = useCallback((list: KolektifRow[]) => {
    const next: Record<string, RowState> = {};
    for (const r of list) {
      next[r.anggota_id] = {
        selected: false,
        sm_pokok: Number(r.sm_pokok) || 0,
        sm_wajib: Number(r.sm_wajib) || 0,
        sm_sukarela: Number(r.sm_sukarela) || 0,
      };
    }
    setRowState(next);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: KolektifRow[]; grand: Grand; bulan: string }>(
        `/pinjaman/kolektif?bulan=${encodeURIComponent(bulan)}`,
      )
      .then((r) => {
        const list = r.rows || [];
        setRows(list);
        setGrand(r.grand || ({} as Grand));
        if (r.bulan) setBulan(r.bulan);
        initRows(list);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bulan, initRows]);

  useEffect(() => {
    load();
  }, [load]);

  const rowMeta = useMemo(() => {
    const m: Record<string, { angsuran: number; toko: number; kredit: number; tunggakan: number; pinIds: string[] }> = {};
    for (const r of rows) {
      m[r.anggota_id] = {
        angsuran: Number(r.total_angsuran) || 0,
        toko: Number(r.total_toko) || 0,
        kredit: Number(r.total_kredit) || 0,
        tunggakan: Number(r.tunggakan) || 0,
        pinIds: (r.pinjaman || []).map((p) => p.id).filter(Boolean),
      };
    }
    return m;
  }, [rows]);

  function calcRowTotal(aid: string) {
    const d = rowMeta[aid];
    const rs = rowState[aid];
    if (!d || !rs) return 0;
    return d.angsuran + rs.sm_pokok + rs.sm_wajib + rs.sm_sukarela + d.toko + d.kredit + d.tunggakan;
  }

  function updateRow(aid: string, patch: Partial<RowState>) {
    setRowState((prev) => ({ ...prev, [aid]: { ...prev[aid], ...patch } }));
  }

  function toggleAll(checked: boolean) {
    setRowState((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.anggota_id]) next[r.anggota_id] = { ...next[r.anggota_id], selected: checked };
      }
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => rowState[r.anggota_id]?.selected);
  const selectedCount = rows.filter((r) => rowState[r.anggota_id]?.selected).length;

  async function prosesKolektif() {
    const checked = rows.filter((r) => rowState[r.anggota_id]?.selected);
    if (!checked.length) {
      alert('Pilih minimal satu anggota');
      return;
    }

    const pin_ids: string[] = [];
    const sm_anggota_id: string[] = [];
    const sm_pokok: number[] = [];
    const sm_wajib: number[] = [];
    const sm_sukarela: number[] = [];
    let totalAngs = 0;
    let totalSim = 0;

    for (const r of checked) {
      const d = rowMeta[r.anggota_id];
      const rs = rowState[r.anggota_id];
      if (d?.pinIds.length) {
        pin_ids.push(...d.pinIds);
        totalAngs += d.angsuran;
      }
      const p = rs.sm_pokok || 0;
      const w = rs.sm_wajib || 0;
      const s = rs.sm_sukarela || 0;
      if (p || w || s) {
        sm_anggota_id.push(r.anggota_id);
        sm_pokok.push(p);
        sm_wajib.push(w);
        sm_sukarela.push(s);
        totalSim += p + w + s;
      }
    }

    if (
      !confirm(
        `Proses KOLEKTIF POTONG GAJI untuk ${checked.length} anggota?\n\n• Angsuran Pinjaman: Rp ${fmtRp(totalAngs)}\n• Setor Simpanan: Rp ${fmtRp(totalSim)}\n• Total: Rp ${fmtRp(totalAngs + totalSim)}`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ message?: string }>('/pinjaman/kolektif/proses', {
        tgl,
        bulan,
        metode,
        pin_id: pin_ids,
        sm_anggota_id,
        sm_pokok,
        sm_wajib,
        sm_sukarela,
      });
      setFlash(res.message || 'Berhasil diproses');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal memproses');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  function printSlipTerpilih() {
    const ids = rows.filter((r) => rowState[r.anggota_id]?.selected).map((r) => r.anggota_id);
    if (!ids.length) {
      alert('Pilih minimal satu anggota');
      return;
    }
    window.open(`/pinjaman/kolektif/slip-batch?bulan=${bulan}&ids=${ids.join(',')}`, '_blank');
  }

  if (loading && !rows.length) {
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
          <h2>Kolektif Potong Gaji</h2>
          <p>
            {rows.length} anggota · Bulan: <b>{bulan}</b> · Total Potongan: <b>Rp {fmtRp(grand.total_potong)}</b>
          </p>
        </div>
        <div className="pg-hdr-right no-print">
          <a
            href={api.exportUrl(`/pinjaman/kolektif/export?fmt=xlsx&bulan=${bulan}`)}
            className="btn btn-sm btn-outline-success"
            style={btnStyle}
            target="_blank"
            rel="noreferrer"
          >
            Excel
          </a>
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
            Print Daftar
          </button>
          <Link href={`/pinjaman/kolektif/ringkasan?bulan=${bulan}`} className="btn btn-sm btn-outline-secondary" style={btnStyle}>
            Ringkasan
          </Link>
          <Link href="/pinjaman" className="btn btn-sm btn-outline-secondary" style={btnStyle}>
            Pinjaman
          </Link>
        </div>
      </div>

      <div className="row g-2 mb-3 no-print">
        {[
          { label: 'Total Angsuran Pin.', val: grand.total_angsuran, color: '#1D4ED8' },
          { label: 'Total Simpanan', val: grand.total_simpanan, color: '#7C3AED' },
          { label: 'Kredit Toko', val: grand.total_toko, color: '#D97706' },
          { label: 'Kredit Motor/Elek', val: grand.total_kredit, color: '#D97706' },
          { label: 'Tunggakan', val: grand.tunggakan, color: '#DC2626' },
          { label: 'GRAND TOTAL', val: grand.total_potong, color: '#0F2744' },
        ].map((c) => (
          <div className="col-md-2" key={c.label}>
            <div className="stat-card" style={{ cursor: 'default', borderLeft: `3px solid ${c.color}` }}>
              <div className="stat-val" style={{ fontSize: 13, color: c.color === '#DC2626' || c.color === '#0F2744' ? c.color : undefined }}>
                Rp {fmtRp(c.val)}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar no-print mb-3 d-flex flex-wrap gap-2 align-items-center">
        <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Bulan:</label>
        <input
          type="month"
          className="form-control form-control-sm"
          style={{ width: 165, borderRadius: 6 }}
          value={bulan}
          onChange={(e) => setBulan(e.target.value)}
        />
        <input type="date" className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} value={tgl} onChange={(e) => setTgl(e.target.value)} />
        <select className="form-select form-select-sm" style={{ width: 155, borderRadius: 6 }} value={metode} onChange={(e) => setMetode(e.target.value)}>
          <option value="potong-gaji">Potong Gaji</option>
          <option value="transfer">Transfer</option>
          <option value="tunai">Tunai</option>
        </select>
        <div style={{ height: 30, borderLeft: '1px solid #E2E8F0', margin: '0 4px' }} />
        <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => toggleAll(true)}>
          Pilih Semua
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" style={btnStyle} onClick={() => toggleAll(false)}>
          Batal ({selectedCount})
        </button>
        <button type="button" className="btn btn-sm" style={{ background: '#059669', color: '#fff', borderRadius: 6, fontSize: 12 }} onClick={printSlipTerpilih}>
          Print Slip
        </button>
        <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={prosesKolektif} disabled={saving}>
          {saving ? 'Memproses...' : 'Proses Potong Gaji'}
        </button>
      </div>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0" style={{ minWidth: 1200, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} title="Pilih Semua" />
              </th>
              <th>No</th>
              <th>No Ang</th>
              <th>Nama</th>
              <th>Dept</th>
              <th>No Rekening</th>
              <th>Bank</th>
              <th className="text-end" style={{ background: '#DBEAFE' }}>
                Angsuran Pin.
              </th>
              <th className="text-end" style={{ background: '#EDE9FE' }}>
                Setor Pokok
              </th>
              <th className="text-end" style={{ background: '#EDE9FE' }}>
                Setor Wajib
              </th>
              <th className="text-end" style={{ background: '#EDE9FE' }}>
                Setor Sukarela
              </th>
              <th className="text-end" style={{ background: '#FEF9C3' }}>
                Kredit Toko
              </th>
              <th className="text-end" style={{ background: '#FEF9C3' }}>
                Kredit Mtr/Elek
              </th>
              <th className="text-end" style={{ background: '#FEE2E2' }}>
                Tunggakan
              </th>
              <th className="text-end" style={{ background: '#D1FAE5', fontWeight: 700 }}>
                TOTAL POTONG
              </th>
              <th className="no-print">Slip</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={16} className="text-center text-muted py-4">
                  Belum ada data
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const rs = rowState[r.anggota_id] || { selected: false, sm_pokok: 0, sm_wajib: 0, sm_sukarela: 0 };
                const rowTotal = calcRowTotal(r.anggota_id);
                return (
                  <tr key={r.anggota_id} style={{ opacity: rs.selected ? 1 : 0.5 }}>
                    <td>
                      <input type="checkbox" checked={rs.selected} onChange={(e) => updateRow(r.anggota_id, { selected: e.target.checked })} />
                    </td>
                    <td className="text-muted" style={{ fontSize: 10 }}>
                      {i + 1}
                    </td>
                    <td>
                      <span className="mono fw-semibold" style={{ fontSize: 11 }}>
                        {r.no}
                      </span>
                    </td>
                    <td className="fw-semibold">
                      {r.nama}
                      <br />
                      <span className="mono" style={{ fontSize: 9, color: '#94A3B8' }}>
                        {r.nip}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B' }}>{r.dept}</td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {r.no_rek || '—'}
                    </td>
                    <td style={{ fontSize: 10 }}>{r.nama_bank || '—'}</td>
                    <td className="text-end mono fw-semibold" style={{ background: '#EFF6FF' }}>
                      {r.total_angsuran ? fmtRp(r.total_angsuran) : '—'}
                      {r.pinjaman?.length ? (
                        <>
                          <br />
                          <span style={{ fontSize: 9, color: '#64748B' }}>{r.pinjaman.length}x pin</span>
                        </>
                      ) : null}
                    </td>
                    <td style={{ background: '#F5F3FF', padding: 2 }}>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        step={1000}
                        value={rs.sm_pokok || ''}
                        style={{ textAlign: 'right', fontSize: 11, border: '1px solid #C4B5FD', borderRadius: 3 }}
                        onChange={(e) => updateRow(r.anggota_id, { sm_pokok: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td style={{ background: '#F5F3FF', padding: 2 }}>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        step={1000}
                        value={rs.sm_wajib || ''}
                        style={{ textAlign: 'right', fontSize: 11, border: '1px solid #C4B5FD', borderRadius: 3 }}
                        onChange={(e) => updateRow(r.anggota_id, { sm_wajib: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td style={{ background: '#F5F3FF', padding: 2 }}>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        step={1000}
                        value={rs.sm_sukarela || ''}
                        style={{ textAlign: 'right', fontSize: 11, border: '1px solid #C4B5FD', borderRadius: 3 }}
                        onChange={(e) => updateRow(r.anggota_id, { sm_sukarela: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="text-end mono" style={{ background: '#FFFBEB', fontSize: 11 }}>
                      {r.total_toko ? fmtRp(r.total_toko) : '—'}
                    </td>
                    <td className="text-end mono" style={{ background: '#FFFBEB', fontSize: 11 }}>
                      {r.total_kredit ? fmtRp(r.total_kredit) : '—'}
                    </td>
                    <td className="text-end mono fw-semibold" style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11 }}>
                      {r.tunggakan ? fmtRp(r.tunggakan) : '—'}
                    </td>
                    <td className="text-end mono fw-bold" style={{ background: '#DCFCE7', color: '#0F2744', fontSize: 12 }}>
                      {fmtRp(rowTotal)}
                    </td>
                    <td className="no-print">
                      <Link
                        href={`/pinjaman/kolektif/slip/${r.anggota_id}?bulan=${bulan}`}
                        target="_blank"
                        className="btn btn-act btn-outline-info"
                        title="Slip"
                      >
                        <i className="bi bi-file-earmark-person" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="fw-bold" style={{ background: '#F0F4FF', fontSize: 11 }}>
                <td colSpan={7} className="text-end" style={{ borderTop: '2px solid #0F2744' }}>
                  TOTAL ({rows.length} anggota)
                </td>
                <td className="text-end mono" style={{ background: '#EFF6FF', borderTop: '2px solid #0F2744' }}>
                  {fmtRp(grand.total_angsuran)}
                </td>
                <td colSpan={3} className="text-end mono" style={{ background: '#F5F3FF', borderTop: '2px solid #0F2744' }}>
                  {fmtRp(grand.total_simpanan)}
                </td>
                <td colSpan={2} className="text-end mono" style={{ background: '#FFFBEB', borderTop: '2px solid #0F2744' }}>
                  {fmtRp(grand.total_toko + grand.total_kredit)}
                </td>
                <td className="text-end mono" style={{ background: '#FEF2F2', borderTop: '2px solid #0F2744', color: '#DC2626' }}>
                  {fmtRp(grand.tunggakan)}
                </td>
                <td className="text-end mono" style={{ background: '#DCFCE7', borderTop: '2px solid #0F2744', color: '#0F2744', fontSize: 13 }}>
                  {fmtRp(grand.total_potong)}
                </td>
                <td style={{ borderTop: '2px solid #0F2744' }} className="no-print" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

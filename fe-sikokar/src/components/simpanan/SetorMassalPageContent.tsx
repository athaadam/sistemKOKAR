'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today, bulanIni } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type AnggotaRow = {
  id: string;
  no: string;
  nip?: string;
  nama: string;
  dept?: string;
  saldo?: Record<string, number>;
};

type RowState = {
  selected: boolean;
  pokok: number;
  wajib: number;
  sukarela: number;
};

const btnStyle = { borderRadius: 6, fontSize: 12 };

const METODE_OPTS = [
  { value: 'potong-gaji', label: 'Potong Gaji' },
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
];

function saldo(a: AnggotaRow, jenis: string) {
  return Number(a.saldo?.[jenis] || 0);
}

export function SetorMassalPageContent() {
  const [anggotaList, setAnggotaList] = useState<AnggotaRow[]>([]);
  const [bulan, setBulan] = useState(bulanIni());
  const [tgl, setTgl] = useState(today());
  const [metode, setMetode] = useState('potong-gaji');
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [bulkPokok, setBulkPokok] = useState(0);
  const [bulkWajib, setBulkWajib] = useState(0);
  const [bulkSukarela, setBulkSukarela] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');

  const initRows = useCallback((list: AnggotaRow[]) => {
    const next: Record<string, RowState> = {};
    for (const a of list) {
      next[a.id] = { selected: true, pokok: 0, wajib: 0, sukarela: 0 };
    }
    setRowState(next);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ anggota_list: AnggotaRow[]; bulan: string }>(
        `/simpanan/setor_massal?bulan=${encodeURIComponent(bulan)}`,
      )
      .then((r) => {
        const list = r.anggota_list || [];
        setAnggotaList(list);
        if (r.bulan) setBulan(r.bulan);
        initRows(list);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bulan, initRows]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = useMemo(
    () => anggotaList.length > 0 && anggotaList.every((a) => rowState[a.id]?.selected),
    [anggotaList, rowState],
  );

  const totals = useMemo(() => {
    let tp = 0;
    let tw = 0;
    let ts = 0;
    let selected = 0;
    for (const a of anggotaList) {
      const rs = rowState[a.id];
      if (!rs) continue;
      if (rs.selected) selected++;
      tp += rs.pokok;
      tw += rs.wajib;
      ts += rs.sukarela;
    }
    return { tp, tw, ts, selected, all: tp + tw + ts };
  }, [anggotaList, rowState]);

  function showFlash(msg: string, type = 'success') {
    setFlash(msg);
    setFlashType(type);
  }

  function toggleAll(checked: boolean) {
    setRowState((prev) => {
      const next = { ...prev };
      for (const a of anggotaList) {
        if (next[a.id]) next[a.id] = { ...next[a.id], selected: checked };
      }
      return next;
    });
  }

  function selectAll() {
    toggleAll(true);
  }

  function clearSel() {
    toggleAll(false);
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRowState((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function applyAll() {
    if (!bulkPokok && !bulkWajib && !bulkSukarela) {
      alert('Masukkan minimal satu nilai > 0');
      return;
    }
    setRowState((prev) => {
      const next = { ...prev };
      for (const a of anggotaList) {
        next[a.id] = {
          ...next[a.id],
          pokok: bulkPokok,
          wajib: bulkWajib,
          sukarela: bulkSukarela,
        };
      }
      return next;
    });
    showFlash(`Diterapkan ke semua ${anggotaList.length} anggota!`);
  }

  function applySelected() {
    if (!bulkPokok && !bulkWajib && !bulkSukarela) {
      alert('Masukkan minimal satu nilai > 0');
      return;
    }
    let cnt = 0;
    setRowState((prev) => {
      const next = { ...prev };
      for (const a of anggotaList) {
        const rs = next[a.id];
        if (!rs?.selected) continue;
        next[a.id] = {
          ...rs,
          pokok: bulkPokok ? bulkPokok : rs.pokok,
          wajib: bulkWajib ? bulkWajib : rs.wajib,
          sukarela: bulkSukarela ? bulkSukarela : rs.sukarela,
        };
        cnt++;
      }
      return next;
    });
    showFlash(`Diterapkan ke ${cnt} anggota terpilih!`);
  }

  function clearAll() {
    setRowState((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], pokok: 0, wajib: 0, sukarela: 0 };
      }
      return next;
    });
  }

  async function prosesSetor() {
    const data: { id: string; p: number; w: number; s: number }[] = [];
    for (const a of anggotaList) {
      const rs = rowState[a.id];
      if (!rs?.selected) continue;
      const p = rs.pokok || 0;
      const w = rs.wajib || 0;
      const s = rs.sukarela || 0;
      if (p > 0 || w > 0 || s > 0) data.push({ id: a.id, p, w, s });
    }

    if (data.length === 0) {
      alert(
        'Tidak ada data untuk diproses.\nPastikan:\n1. Ada anggota yang dipilih (checkbox)\n2. Sudah mengisi nilai setoran > 0',
      );
      return;
    }

    const sumP = data.reduce((s, r) => s + r.p, 0);
    const sumW = data.reduce((s, r) => s + r.w, 0);
    const sumS = data.reduce((s, r) => s + r.s, 0);

    if (
      !confirm(
        `Proses setoran untuk ${data.length} anggota?\n\nTotal:\n• Pokok: Rp ${fmtRp(sumP)}\n• Wajib: Rp ${fmtRp(sumW)}\n• Sukarela: Rp ${fmtRp(sumS)}`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/simpanan/setor_massal/proses', {
        bulan,
        tgl,
        metode,
        anggota_id: data.map((d) => d.id),
        pokok: data.map((d) => d.p),
        wajib: data.map((d) => d.w),
        sukarela: data.map((d) => d.s),
      });
      showFlash(r.message || `Setor massal berhasil: ${data.length} anggota diproses`);
      clearAll();
      load();
    } catch (ex) {
      showFlash(ex instanceof Error ? ex.message : 'Gagal memproses setor massal', 'danger');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !anggotaList.length) {
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
            <IconRenderer icon={ICON_MAP.setorMassal_custom} size={24} style={{ marginRight: 8 }} />
            Setor Massal Simpanan
          </h2>
          <p>{anggotaList.length} anggota aktif</p>
        </div>
        <div className="pg-hdr-right no-print">
          <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={() => window.print()}>
            Print
          </button>
          <Link href="/simpanan" className="btn btn-sm btn-outline-secondary" style={btnStyle}>
            Kembali
          </Link>
        </div>
      </div>

      <div className="card mb-3 no-print" style={{ border: '1px solid #E2E8F0', borderRadius: 8 }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="fl">Bulan Setor</label>
              <input
                type="month"
                className="form-control form-control-sm"
                style={{ width: 165, borderRadius: 6 }}
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="fl">Tanggal</label>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ width: 145, borderRadius: 6 }}
                value={tgl}
                onChange={(e) => setTgl(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="fl">Metode</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 155, borderRadius: 6 }}
                value={metode}
                onChange={(e) => setMetode(e.target.value)}
              >
                {METODE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3 no-print" style={{ border: '2px solid #1D4ED8', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#1D4ED8', color: '#fff', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>
          Isi Jumlah Setoran — Sama untuk Semua / Terpilih
        </div>
        <div className="card-body p-3">
          <div className="row g-2 align-items-center mb-2">
            <div className="col-auto">
              <label className="fl" style={{ color: '#1D4ED8' }}>
                Pokok (Rp)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={bulkPokok || ''}
                min={0}
                step={1000}
                style={{ width: 130, border: '2px solid #93C5FD', borderRadius: 6, textAlign: 'right' }}
                onChange={(e) => setBulkPokok(Number(e.target.value) || 0)}
              />
            </div>
            <div className="col-auto">
              <label className="fl" style={{ color: '#7C3AED' }}>
                Wajib (Rp)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={bulkWajib || ''}
                min={0}
                step={1000}
                style={{ width: 130, border: '2px solid #C4B5FD', borderRadius: 6, textAlign: 'right' }}
                onChange={(e) => setBulkWajib(Number(e.target.value) || 0)}
              />
            </div>
            <div className="col-auto">
              <label className="fl" style={{ color: '#16A34A' }}>
                Sukarela (Rp)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={bulkSukarela || ''}
                min={0}
                step={1000}
                style={{ width: 130, border: '2px solid #86EFAC', borderRadius: 6, textAlign: 'right' }}
                onChange={(e) => setBulkSukarela(Number(e.target.value) || 0)}
              />
            </div>
            <div className="col-auto">
              <label className="fl">&nbsp;</label>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm fw-bold"
                  style={{ background: '#1D4ED8', color: '#fff', borderRadius: 6, fontSize: 12 }}
                  onClick={applyAll}
                >
                  Terapkan ke Semua
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  style={{ borderRadius: 6, fontSize: 12 }}
                  onClick={applySelected}
                >
                  Terapkan ke Terpilih
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  style={{ borderRadius: 6, fontSize: 12 }}
                  onClick={clearAll}
                >
                  Kosongkan Semua
                </button>
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#3B82F6',
              padding: '5px 10px',
              background: '#EFF6FF',
              borderRadius: 6,
              borderLeft: '3px solid #3B82F6',
            }}
          >
            Contoh: Ketik <b>Wajib = 400.000</b> → klik <b>&quot;Terapkan ke Semua&quot;</b> → semua baris terisi 400.000 di kolom Wajib
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 align-items-center mb-2 no-print flex-wrap">
        <button type="button" className="btn btn-sm btn-outline-primary" style={btnStyle} onClick={selectAll}>
          Pilih Semua
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" style={btnStyle} onClick={clearSel}>
          Batal Semua
        </button>
        <div style={{ height: 24, borderLeft: '1px solid #E2E8F0', margin: '0 4px' }} />
        <span style={{ fontSize: 12, color: '#64748B' }}>
          Terpilih: <b>{totals.selected}</b> anggota
        </span>
        <span style={{ fontSize: 12, color: '#1D4ED8' }}>
          Pokok: <b>{fmtRp(totals.tp)}</b>
        </span>
        <span style={{ fontSize: 12, color: '#7C3AED' }}>
          Wajib: <b>{fmtRp(totals.tw)}</b>
        </span>
        <span style={{ fontSize: 12, color: '#16A34A' }}>
          Sukarela: <b>{fmtRp(totals.ts)}</b>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>
          Total: <b>{fmtRp(totals.all)}</b>
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-sm btn-navy fw-bold"
            style={{ borderRadius: 6, fontSize: 12, padding: '6px 16px' }}
            onClick={prosesSetor}
            disabled={saving}
          >
            {saving ? 'Memproses...' : 'Proses Setor Massal'}
          </button>
        </div>
      </div>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0" style={{ minWidth: 820, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  title="Pilih Semua"
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th style={{ width: 35 }}>No</th>
              <th style={{ width: 75 }}>No Ang</th>
              <th style={{ width: 90 }}>NIP</th>
              <th>Nama Anggota</th>
              <th style={{ width: 80 }}>Dept</th>
              <th className="text-end" style={{ background: '#DBEAFE', width: 90 }}>
                Saldo Pokok
              </th>
              <th className="text-end" style={{ background: '#EDE9FE', width: 90 }}>
                Saldo Wajib
              </th>
              <th className="text-end" style={{ background: '#DCFCE7', width: 90 }}>
                Saldo Sukarela
              </th>
              <th className="text-end" style={{ background: '#BFDBFE', minWidth: 115 }}>
                Setor Pokok (Rp)
              </th>
              <th className="text-end" style={{ background: '#C4B5FD', minWidth: 115 }}>
                Setor Wajib (Rp)
              </th>
              <th className="text-end" style={{ background: '#86EFAC', minWidth: 115 }}>
                Setor Sukarela (Rp)
              </th>
            </tr>
          </thead>
          <tbody>
            {anggotaList.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center text-muted py-4">
                  Tidak ada anggota aktif
                </td>
              </tr>
            ) : (
              anggotaList.map((a, i) => {
                const rs = rowState[a.id] || { selected: false, pokok: 0, wajib: 0, sukarela: 0 };
                return (
                  <tr key={a.id} style={{ opacity: rs.selected ? 1 : 0.4 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={rs.selected}
                        onChange={(e) => updateRow(a.id, { selected: e.target.checked })}
                      />
                    </td>
                    <td className="text-muted" style={{ fontSize: 11 }}>
                      {i + 1}
                    </td>
                    <td>
                      <span className="mono fw-semibold" style={{ fontSize: 11 }}>
                        {a.no}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 10 }}>
                        {a.nip}
                      </span>
                    </td>
                    <td className="fw-semibold">{a.nama}</td>
                    <td style={{ fontSize: 11, color: '#64748B' }}>{a.dept}</td>
                    <td className="text-end mono" style={{ background: '#DBEAFE', fontSize: 11, color: '#1D4ED8' }}>
                      {fmtRp(saldo(a, 'pokok'))}
                    </td>
                    <td className="text-end mono" style={{ background: '#EDE9FE', fontSize: 11, color: '#7C3AED' }}>
                      {fmtRp(saldo(a, 'wajib'))}
                    </td>
                    <td className="text-end mono" style={{ background: '#DCFCE7', fontSize: 11, color: '#16A34A' }}>
                      {fmtRp(saldo(a, 'sukarela'))}
                    </td>
                    <td style={{ padding: 3, background: '#EFF6FF' }}>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        step={1000}
                        value={rs.pokok || ''}
                        style={{ textAlign: 'right', fontSize: 12, border: '1px solid #93C5FD', borderRadius: 4 }}
                        onChange={(e) => updateRow(a.id, { pokok: Number(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td style={{ padding: 3, background: '#F5F3FF' }}>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        step={1000}
                        value={rs.wajib || ''}
                        style={{ textAlign: 'right', fontSize: 12, border: '1px solid #C4B5FD', borderRadius: 4 }}
                        onChange={(e) => updateRow(a.id, { wajib: Number(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td style={{ padding: 3, background: '#F0FDF4' }}>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        step={1000}
                        value={rs.sukarela || ''}
                        style={{ textAlign: 'right', fontSize: 12, border: '1px solid #86EFAC', borderRadius: 4 }}
                        onChange={(e) => updateRow(a.id, { sukarela: Number(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="fw-bold" style={{ background: '#F8FAFC', fontSize: 11 }}>
              <td colSpan={6} className="text-end" style={{ borderTop: '2px solid #0F2744' }}>
                TOTAL SETORAN
              </td>
              <td colSpan={3} style={{ borderTop: '2px solid #0F2744' }} />
              <td className="text-end mono" style={{ background: '#BFDBFE', borderTop: '2px solid #0F2744' }}>
                {fmtRp(totals.tp)}
              </td>
              <td className="text-end mono" style={{ background: '#C4B5FD', borderTop: '2px solid #0F2744' }}>
                {fmtRp(totals.tw)}
              </td>
              <td className="text-end mono" style={{ background: '#86EFAC', borderTop: '2px solid #0F2744' }}>
                {fmtRp(totals.ts)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

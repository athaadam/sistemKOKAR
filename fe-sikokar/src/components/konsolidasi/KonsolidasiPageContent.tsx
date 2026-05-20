'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, bulanIni } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { ReportExportBar } from '@/components/report/ReportExportBar';

type Row = Record<string, unknown>;
type Grand = Record<string, number>;

function n(v: unknown): number {
  return Number(v) || 0;
}

function cellMoney(v: unknown): string {
  const x = n(v);
  return x ? fmtRp(x) : '—';
}

export function KonsolidasiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tglFrom = searchParams.get('tgl_from') || '';
  const tglTo = searchParams.get('tgl_to') || '';
  const [draftFrom, setDraftFrom] = useState(tglFrom);
  const [draftTo, setDraftTo] = useState(tglTo);

  const [rows, setRows] = useState<Row[]>([]);
  const [grand, setGrand] = useState<Grand>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const qs = `${tglFrom ? `tgl_from=${encodeURIComponent(tglFrom)}&` : ''}${tglTo ? `tgl_to=${encodeURIComponent(tglTo)}` : ''}`.replace(/&$/, '');
  const exportPath = `/konsolidasi/export?${qs}`;

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: Row[]; grand: Grand }>(`/konsolidasi${qs ? `?${qs}` : ''}`)
      .then((r) => {
        setRows(r.rows || []);
        setGrand((r.grand as Grand) || {});
      })
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

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const keys = ['', 'no', 'nip', 'nama', 'dept', 'sm_pokok', 'sm_wajib', 'sm_sukarela', 'total_simpanan', 'pinjaman_aktif', 'angsuran_bln', 'kredit_motor', 'angs_motor', 'kredit_elek', 'angs_elek', 'belanja_kredit', 'piutang', 'tunggakan'];
      const key = keys[sortCol];
      if (!key) return 0;
      const av = n(a[key]);
      const bv = n(b[key]);
      if (av !== bv || (typeof a[key] === 'number' && typeof b[key] === 'number')) {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'id')
        : String(b[key] ?? '').localeCompare(String(a[key] ?? ''), 'id');
    });
    return copy;
  }, [rows, sortCol, sortAsc]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (draftFrom) p.set('tgl_from', draftFrom);
    if (draftTo) p.set('tgl_to', draftTo);
    router.push(`/konsolidasi?${p.toString()}`);
  }

  function onSort(col: number) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  }

  async function saveSnapshot() {
    if (!confirm(`Simpan snapshot konsolidasi untuk periode ${bulanIni()}?`)) return;
    try {
      const r = await api.post<{ message?: string }>('/konsolidasi/snapshot', { periode: bulanIni() });
      setFlash(r.message || 'Snapshot tersimpan');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Gagal menyimpan snapshot');
    }
  }

  const th = (col: number, label: string, bg?: string, color?: string) => (
    <th
      className="text-end"
      style={{ background: bg, color, cursor: 'pointer', verticalAlign: 'bottom' }}
      title="Klik untuk sort"
      onClick={() => onSort(col)}
    >
      {label}
    </th>
  );

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;

  return (
    <>
      {flash && <Flash message={flash} type="success" onClose={() => setFlash('')} />}
      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2>📊 Laporan Konsolidasi Anggota</h2>
          <p>Simpanan · Pinjaman · Kredit · Belanja · Piutang — {rows.length} anggota aktif</p>
        </div>
        <ReportExportBar
          exportPath={exportPath}
          extra={
            <button type="button" className="btn btn-sm btn-outline-dark" style={{ borderRadius: 6, fontSize: 12 }} onClick={saveSnapshot}>
              <i className="bi bi-camera me-1" /> Snapshot
            </button>
          }
        />
      </div>

      <form className="toolbar no-print d-flex flex-wrap align-items-center gap-2 mb-3" onSubmit={onFilter}>
        <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Periode Belanja Kredit:</label>
        <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>s/d</span>
        <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="form-control form-control-sm" style={{ width: 145, borderRadius: 6 }} />
        <button type="submit" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }}>Filter</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6 }} onClick={() => router.push('/konsolidasi')}>Reset</button>
      </form>

      <div className="row g-2 mb-3 no-print">
        {[
          ['Total Simpanan', grand.total_simpanan, '#1D4ED8'],
          ['Outstanding Pin.', grand.pinjaman_aktif, '#DC2626'],
          ['KR Motor (sisa)', grand.kredit_motor, '#D97706'],
          ['KR Elektronik (sisa)', grand.kredit_elek, '#059669'],
          ['Belanja Kredit', grand.belanja_kredit, '#7C3AED'],
          ['Tunggakan', grand.tunggakan, '#0F2744'],
        ].map(([label, val, color]) => (
          <div className="col-md-2 col-6" key={String(label)}>
            <div className="stat-card" style={{ cursor: 'default', borderLeft: `3px solid ${color}` }}>
              <div className="stat-val" style={{ fontSize: 13 }}>Rp {fmtRp(val as number)}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
        <table className="table table-sm" style={{ fontSize: 11, minWidth: 1350 }}>
          <thead>
            <tr style={{ verticalAlign: 'bottom' }}>
              <th onClick={() => onSort(0)} style={{ cursor: 'pointer' }}>No</th>
              <th onClick={() => onSort(1)} style={{ cursor: 'pointer' }}>No Ang.</th>
              <th onClick={() => onSort(2)} style={{ cursor: 'pointer' }}>NIP</th>
              <th onClick={() => onSort(3)} style={{ cursor: 'pointer' }}>Nama</th>
              <th onClick={() => onSort(4)} style={{ cursor: 'pointer' }}>Dept</th>
              {th(5, 'Sim. Pokok', '#DBEAFE')}
              {th(6, 'Sim. Wajib', '#DBEAFE')}
              {th(7, 'Sim. Sukarela', '#DBEAFE')}
              <th className="text-end" style={{ background: '#1D4ED8', color: '#fff', cursor: 'pointer' }} onClick={() => onSort(8)}>Total Simpanan</th>
              {th(9, 'Pinjaman Aktif', '#FEE2E2')}
              {th(10, 'Angsuran/bln', '#FEE2E2')}
              {th(11, 'KR Motor (sisa)', '#FEF3C7')}
              {th(12, 'Angs. Motor/bln', '#FEF3C7')}
              {th(13, 'KR Elektronik (sisa)', '#D1FAE5')}
              {th(14, 'Angs. Elek/bln', '#D1FAE5')}
              {th(15, 'Belanja Kredit', '#EDE9FE')}
              {th(16, 'Piutang Toko', '#EDE9FE')}
              <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => onSort(17)}>Tunggakan</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => (
              <tr key={i} className={n(r.tunggakan) > 0 ? 'table-danger' : ''}>
                <td className="text-muted">{i + 1}</td>
                <td><span className="mono" style={{ fontSize: 10 }}>{String(r.no)}</span></td>
                <td><span className="mono" style={{ fontSize: 10 }}>{String(r.nip)}</span></td>
                <td className="fw-semibold">{String(r.nama)}</td>
                <td style={{ fontSize: 10, color: '#64748B' }}>{String(r.dept)}</td>
                <td className="text-end mono" style={{ background: '#EFF6FF' }}>{cellMoney(r.sm_pokok)}</td>
                <td className="text-end mono" style={{ background: '#EFF6FF' }}>{cellMoney(r.sm_wajib)}</td>
                <td className="text-end mono" style={{ background: '#EFF6FF' }}>{cellMoney(r.sm_sukarela)}</td>
                <td className="text-end mono fw-semibold" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>{cellMoney(r.total_simpanan)}</td>
                <td className="text-end mono" style={{ background: '#FEF2F2', color: '#DC2626' }}>{cellMoney(r.pinjaman_aktif)}</td>
                <td className="text-end mono" style={{ background: '#FEF2F2' }}>{cellMoney(r.angsuran_bln)}</td>
                <td className="text-end mono" style={{ background: '#FFFBEB' }}>{cellMoney(r.kredit_motor)}</td>
                <td className="text-end mono" style={{ background: '#FFFBEB' }}>{cellMoney(r.angs_motor)}</td>
                <td className="text-end mono" style={{ background: '#ECFDF5' }}>{cellMoney(r.kredit_elek)}</td>
                <td className="text-end mono" style={{ background: '#ECFDF5' }}>{cellMoney(r.angs_elek)}</td>
                <td className="text-end mono" style={{ background: '#F5F3FF' }}>{cellMoney(r.belanja_kredit)}</td>
                <td className="text-end mono" style={{ background: '#F5F3FF' }}>{cellMoney(r.piutang)}</td>
                <td className="text-center">
                  {n(r.tunggakan) > 0 ? <span className="bd bd-red">{String(r.tunggakan)}</span> : <span className="bd bd-green">0</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-bold" style={{ background: '#F0F4FF', fontSize: 11 }}>
              <td colSpan={5} className="text-center" style={{ borderTop: '2px solid #0F2744' }}>GRAND TOTAL ({rows.length} anggota)</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.sm_pokok)}</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.sm_wajib)}</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.sm_sukarela)}</td>
              <td className="text-end mono" style={{ background: '#DBEAFE', borderTop: '2px solid #0F2744', color: '#1D4ED8' }}>{fmtRp(grand.total_simpanan)}</td>
              <td className="text-end mono" style={{ background: '#FEE2E2', borderTop: '2px solid #0F2744', color: '#DC2626' }}>{fmtRp(grand.pinjaman_aktif)}</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.angsuran_bln)}</td>
              <td className="text-end mono" style={{ background: '#FEF3C7', borderTop: '2px solid #0F2744' }}>{fmtRp(grand.kredit_motor)}</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.angs_motor)}</td>
              <td className="text-end mono" style={{ background: '#D1FAE5', borderTop: '2px solid #0F2744' }}>{fmtRp(grand.kredit_elek)}</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.angs_elek)}</td>
              <td className="text-end mono" style={{ background: '#EDE9FE', borderTop: '2px solid #0F2744' }}>{fmtRp(grand.belanja_kredit)}</td>
              <td className="text-end mono" style={{ borderTop: '2px solid #0F2744' }}>{fmtRp(grand.piutang)}</td>
              <td className="text-center" style={{ borderTop: '2px solid #0F2744' }}>
                <span className={`bd ${grand.tunggakan ? 'bd-red' : 'bd-green'}`}>{grand.tunggakan || 0}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

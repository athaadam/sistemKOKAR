'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';

type ScheduleRow = { ke: number; pokok: number; bunga: number; angsuran: number; sisa: number };
type HistoryRow = {
  tgl: string;
  aksi: string;
  tenor_lama: number;
  tenor_baru: number;
  angsuran_lama: number;
  angsuran_baru: number;
  keterangan?: string;
};

type PinData = {
  no: string;
  anggota_nama: string;
  anggota_no: string;
  jenis: string;
  rate_type?: string;
  nominal: number;
  tenor: number;
  bunga: number;
  tgl_cair?: string;
  cicilan_ke?: number;
};

export default function PinjamanSlipPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [p, setP] = useState<PinData | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [cicilanKe, setCicilanKe] = useState(0);
  const [hdr, setHdr] = useState<{ header1?: string; header2?: string; nama_kop?: string; alamat?: string }>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<{
        p: PinData;
        schedule: ScheduleRow[];
        history: HistoryRow[];
        bayar: unknown[];
        hdr: Record<string, string>;
      }>(`/pinjaman/${id}/slip_timeline`)
      .then((r) => {
        setP(r.p);
        setSchedule(r.schedule || []);
        setHistory(r.history || []);
        setCicilanKe(Array.isArray(r.bayar) ? r.bayar.length : 0);
        setHdr(r.hdr || {});
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) {
    return (
      <div className="p-4">
        <p className="text-danger">{err}</p>
        <Link href="/pinjaman">Kembali</Link>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial', fontSize: '11pt', padding: 20, maxWidth: 800, margin: 'auto' }}>
      <style>{`
        .slip-hdr { display: flex; border-bottom: 3px solid #0F2744; padding-bottom: 10px; margin-bottom: 14px; }
        .slip-info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; background: #F8FAFF; padding: 10px; margin-bottom: 14px; }
        .slip-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .slip-table th { background: #0F2744; color: #fff; padding: 6px; text-align: center; }
        .slip-table td { padding: 5px 8px; border-bottom: 1px solid #E2E8F0; }
        .paid { background: #DCFCE7; color: #14532D; }
        @media print { .no-print { display: none !important; } body { padding: 6px; } }
      `}</style>

      <div className="no-print mb-3">
        <button
          type="button"
          onClick={() => window.print()}
          style={{ padding: '6px 16px', background: '#0F2744', color: '#fff', border: 'none', borderRadius: 5, marginRight: 8 }}
        >
          Print
        </button>
        <Link href="/pinjaman">Kembali</Link>
      </div>

      <div className="slip-hdr">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '14pt', color: '#0F2744', margin: 0 }}>{hdr.header1 || hdr.nama_kop || 'SIKOKAR'}</h1>
          <div style={{ fontSize: 10 }}>{hdr.header2 || hdr.alamat}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '18pt', color: '#0F2744', margin: 0 }}>JADWAL CICILAN</h2>
          <div>
            No: <b>{p.no}</b>
          </div>
        </div>
      </div>

      <div className="slip-info">
        <div>
          <b>Anggota:</b> {p.anggota_nama} ({p.anggota_no})
        </div>
        <div>
          <b>Jenis:</b> {p.jenis?.toUpperCase()} — {p.rate_type || 'flat'}
        </div>
        <div>
          <b>Nominal:</b> Rp {fmtRp(p.nominal)}
        </div>
        <div>
          <b>Tenor:</b> {p.tenor} bulan
        </div>
        <div>
          <b>Bunga:</b> {p.bunga}%/bulan
        </div>
        <div>
          <b>Tgl Cair:</b> {p.tgl_cair}
        </div>
      </div>

      <table className="slip-table">
        <thead>
          <tr>
            <th>Cicilan Ke</th>
            <th>Pokok</th>
            <th>Bunga</th>
            <th>Total Angsuran</th>
            <th>Sisa Pokok</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((s) => (
            <tr key={s.ke} className={s.ke <= cicilanKe ? 'paid' : ''}>
              <td style={{ textAlign: 'center' }}>
                {s.ke}/{p.tenor}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtRp(s.pokok)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtRp(s.bunga)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                <b>{fmtRp(s.angsuran)}</b>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtRp(s.sisa)}</td>
              <td style={{ textAlign: 'center' }}>{s.ke <= cicilanKe ? 'Lunas' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {history.length > 0 && (
        <>
          <h4 style={{ marginTop: 14, color: '#0F2744' }}>Riwayat Top-up/Restrukturisasi</h4>
          <table className="slip-table" style={{ fontSize: '9pt' }}>
            <thead>
              <tr>
                <th>Tgl</th>
                <th>Aksi</th>
                <th>Tenor Lama→Baru</th>
                <th>Angsuran Lama→Baru</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{h.tgl}</td>
                  <td>
                    <b>{h.aksi}</b>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {h.tenor_lama}→{h.tenor_baru}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmtRp(h.angsuran_lama)} → {fmtRp(h.angsuran_baru)}
                  </td>
                  <td>{h.keterangan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

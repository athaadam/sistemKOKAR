'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';

export default function StrukPage() {
  const { pj_id } = useParams<{ pj_id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (pj_id) api.get(`/toko/struk/${pj_id}`).then((r) => setData(r as Record<string, unknown>));
  }, [pj_id]);

  if (!data) return <div className="p-4">Memuat struk...</div>;

  const pj = (data.pj as Record<string, unknown>) || data;
  const items = (data.items as Record<string, unknown>[]) || [];
  const hdr = (data.hdr as Record<string, string>) || {};

  return (
    <div className="p-4" style={{ maxWidth: 400, margin: '0 auto' }}>
      <div className="text-center mb-3">
        <h5>{hdr.nama_kop || 'Koperasi KOKARSI'}</h5>
        <small>{hdr.alamat}</small>
      </div>
      <p className="small mb-1">No: {String(pj.no)}</p>
      <p className="small mb-1">Tgl: {String(pj.tgl)}</p>
      <p className="small mb-3">Anggota: {String(pj.anggota_nama || '-')}</p>
      <table className="table table-sm">
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{String(it.nama)}</td>
              <td className="text-end">{String(it.qty)}</td>
              <td className="text-end mono">Rp {fmtRp(Number(it.subtotal || Number(it.harga) * Number(it.qty)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-flex justify-content-between fw-bold border-top pt-2">
        <span>TOTAL</span>
        <span className="mono">Rp {fmtRp(Number(pj.total))}</span>
      </div>
      <button type="button" className="btn btn-navy w-100 mt-3" onClick={() => window.print()}>
        Cetak
      </button>
    </div>
  );
}

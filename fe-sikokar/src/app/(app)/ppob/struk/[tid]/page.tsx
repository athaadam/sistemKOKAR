'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';

export default function PpobStrukPage() {
  const { tid } = useParams<{ tid: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (tid) api.get(`/ppob/struk/${tid}`).then((r) => setData(r as Record<string, unknown>));
  }, [tid]);

  if (!data) return <div className="p-4">Memuat struk...</div>;

  const trx = (data.trx as Record<string, unknown>) || {};
  const kasir = (data.kasir as Record<string, unknown>) || {};
  const hdr = (data.hdr as Record<string, string>) || {};

  return (
    <div className="p-4" style={{ maxWidth: 400, margin: '0 auto' }}>
      <div className="text-center mb-3">
        <h5>{hdr.nama_kop || 'Koperasi'}</h5>
        <small>{hdr.alamat}</small>
        {hdr.telp && (
          <>
            <br />
            <small>{hdr.telp}</small>
          </>
        )}
      </div>
      <hr style={{ borderStyle: 'dashed' }} />
      <div className="d-flex justify-content-between small mb-1">
        <span>No</span>
        <span className="mono">{String(trx.no)}</span>
      </div>
      <div className="d-flex justify-content-between small mb-1">
        <span>Tanggal</span>
        <span>{String(trx.tgl)}</span>
      </div>
      <div className="d-flex justify-content-between small mb-1">
        <span>Kasir</span>
        <span>{String(kasir.name || '-')}</span>
      </div>
      <hr style={{ borderStyle: 'dashed' }} />
      <div className="d-flex justify-content-between small mb-1">
        <span>Layanan</span>
        <span>{String(trx.layanan)}</span>
      </div>
      <div className="d-flex justify-content-between small mb-1">
        <span>Pelanggan</span>
        <span className="mono">{String(trx.pelanggan)}</span>
      </div>
      <div className="d-flex justify-content-between small mb-1">
        <span>Nominal</span>
        <span>Rp {fmtRp(Number(trx.nominal))}</span>
      </div>
      <div className="d-flex justify-content-between small mb-1">
        <span>Fee</span>
        <span>Rp {fmtRp(Number(trx.fee))}</span>
      </div>
      <hr style={{ borderStyle: 'dashed' }} />
      <div className="d-flex justify-content-between fw-bold mb-3">
        <span>Total</span>
        <span>Rp {fmtRp(Number(trx.total))}</span>
      </div>
      <p className="text-center small text-muted mb-3">Status: {String(trx.status)} — Terima kasih</p>
      <button type="button" className="btn btn-navy w-100" onClick={() => window.print()}>
        Cetak
      </button>
    </div>
  );
}

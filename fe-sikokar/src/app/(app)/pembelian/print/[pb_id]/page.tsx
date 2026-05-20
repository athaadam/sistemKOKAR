'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';

export default function PembelianPrintPage() {
  const { pb_id } = useParams<{ pb_id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (pb_id) api.get(`/pembelian/print/${pb_id}`).then((r) => setData(r as Record<string, unknown>));
  }, [pb_id]);

  if (!data) return <div className="p-4">Memuat...</div>;

  const pb = (data.pb as Record<string, unknown>) || {};
  const items = (data.items as Record<string, unknown>[]) || [];
  const hdr = (data.hdr as Record<string, string>) || {};

  return (
    <div className="p-4" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="no-print d-flex gap-2 mb-3">
        <button type="button" className="btn btn-sm btn-navy" onClick={() => window.print()}>
          Print
        </button>
        <Link href="/pembelian" className="btn btn-sm btn-outline-secondary">
          Kembali
        </Link>
      </div>

      <div className="d-flex align-items-center gap-3 border-bottom pb-2 mb-3">
        <div>
          <h5 className="mb-0">{hdr.header1 || hdr.nama_kop || 'Koperasi'}</h5>
          <small className="text-muted">{hdr.header2 || hdr.alamat}</small>
        </div>
        <div className="ms-auto text-end">
          <h6 className="mb-0">BUKTI PEMBELIAN</h6>
          <small>No: {String(pb.no)}</small>
        </div>
      </div>

      <table className="table table-sm mb-3">
        <tbody>
          <tr><td className="fw-semibold" style={{ width: 120 }}>Tanggal</td><td>: {String(pb.tgl)}</td><td className="fw-semibold">Toko</td><td>: {String(pb.lokasi_nama)}</td></tr>
          <tr><td className="fw-semibold">Supplier</td><td>: {String(pb.supplier_nama || '—')}</td><td className="fw-semibold">Status</td><td>: {String(pb.status || '').toUpperCase()}</td></tr>
          {pb.catatan ? <tr><td className="fw-semibold">Catatan</td><td colSpan={3}>: {String(pb.catatan)}</td></tr> : null}
        </tbody>
      </table>

      <table className="table table-sm table-bordered">
        <thead className="table-dark">
          <tr>
            <th style={{ width: 40 }}>No</th>
            <th>Nama Barang</th>
            <th className="text-center" style={{ width: 60 }}>Qty</th>
            <th className="text-end" style={{ width: 120 }}>Harga Beli</th>
            <th className="text-end" style={{ width: 130 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="text-center">{i + 1}</td>
              <td>{String(it.barang_nama || it.nama)}</td>
              <td className="text-center">{String(it.qty)}</td>
              <td className="text-end mono">{fmtRp(Number(it.harga_beli))}</td>
              <td className="text-end mono">{fmtRp(Number(it.subtotal))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="text-end fw-bold">TOTAL</td>
            <td className="text-end mono fw-bold">Rp {fmtRp(Number(pb.total))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

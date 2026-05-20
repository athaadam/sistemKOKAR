'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type KwitansiItem = {
  ket: string;
  qty: number;
  harga: number;
  subtotal: number;
};

type Kwitansi = {
  id: string;
  no: string;
  tipe: string;
  tgl: string;
  penerima: string;
  perusahaan: string;
  subtotal: number;
  diskon: number;
  ppn: number;
  pph: number;
  total: number;
  terbilang: string;
  status: string;
  catatan?: string;
};

type PrintHeader = {
  header1?: string;
  header2?: string;
  nama_kop?: string;
  alamat?: string;
  logo?: string;
};

export function KwitansiPrintPageContent() {
  const params = useParams();
  const kid = String(params.kid || '');

  const [k, setK] = useState<Kwitansi | null>(null);
  const [items, setItems] = useState<KwitansiItem[]>([]);
  const [hdr, setHdr] = useState<PrintHeader>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    api
      .get<{ k: Kwitansi; items: KwitansiItem[]; hdr: PrintHeader }>(`/kwitansi/${kid}`)
      .then((r) => {
        setK(r.k || null);
        setItems(r.items || []);
        setHdr(r.hdr || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [kid]);

  async function onLunas() {
    if (!k || !confirm('Tandai lunas?')) return;
    await api.get(`/kwitansi/lunas/${k.id}`);
    load();
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (err || !k) {
    return (
      <>
        <Flash message={err || 'Tidak ditemukan'} type="danger" />
        <Link href="/kwitansi" className="btn btn-sm btn-secondary">
          ← Kembali
        </Link>
      </>
    );
  }

  const orgName = hdr.header1 || hdr.nama_kop || 'SIKOKAR';
  const orgSub = hdr.header2 || hdr.alamat || '';
  const lunas = k.status === 'lunas';

  return (
    <>
      <style>{`
        .kw-print { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; padding: 16px; max-width: 740px; margin: auto; background: #fff; }
        .kw-print .hdr { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0F2744; padding-bottom: 10px; margin-bottom: 14px; }
        .kw-print .hdr img { max-height: 60px; max-width: 90px; }
        .kw-print .org-name { font-size: 16pt; font-weight: bold; color: #0F2744; }
        .kw-print .doc-type { margin-left: auto; text-align: right; }
        .kw-print .doc-type h1 { font-size: 22pt; font-weight: bold; color: #0F2744; letter-spacing: 2px; margin: 0; }
        .kw-print .doc-type h2 { font-size: 12pt; color: #64748B; margin: 0; }
        .kw-print .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 14px; background: #F8FAFF; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 6px; }
        .kw-print .items-tbl { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .kw-print .items-tbl th { background: #0F2744; color: #fff; padding: 7px 10px; text-align: left; font-size: 10.5pt; }
        .kw-print .items-tbl td { padding: 6px 10px; border-bottom: 1px solid #E2E8F0; font-size: 11pt; }
        .kw-print .num { text-align: right; font-family: 'Courier New', monospace; }
        .kw-print .totals-box { max-width: 320px; margin-left: auto; margin-bottom: 12px; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; }
        .kw-print .totals-box table { width: 100%; border-collapse: collapse; }
        .kw-print .totals-box td { padding: 5px 10px; font-size: 11pt; }
        .kw-print .totals-box tr:last-child td { background: #0F2744; color: #fff; font-weight: bold; font-size: 13pt; }
        .kw-print .terbilang { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 8px 12px; font-size: 11pt; color: #1E3A5F; margin-bottom: 14px; }
        .kw-print .sign-grid { display: flex; justify-content: space-between; margin-top: 30px; gap: 20px; }
        .kw-print .sign-box { flex: 1; text-align: center; font-size: 10pt; }
        .kw-print .sign-space { height: 55px; border-bottom: 1px solid #333; margin-bottom: 4px; }
        @media print { .no-print { display: none !important; } .kw-print { padding: 8px; max-width: 100%; } }
      `}</style>

      <div className="no-print mb-3 d-flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '6px 16px',
            background: '#0F2744',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            fontSize: 11,
          }}
        >
          Print
        </button>
        <Link href="/kwitansi" style={{ fontSize: 11, color: '#0F2744', padding: 6 }}>
          ← Kembali
        </Link>
        {!lunas && (
          <button
            type="button"
            onClick={onLunas}
            style={{
              padding: '6px 14px',
              background: '#16A34A',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 11,
            }}
          >
            Tandai Lunas
          </button>
        )}
      </div>

      <div className="kw-print">
        <div className="hdr">
          {hdr.logo ? (
            <img src={`/api/static/${hdr.logo}`} alt="logo" />
          ) : (
            <div
              style={{
                width: 55,
                height: 55,
                background: '#0F2744',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              🏛️
            </div>
          )}
          <div>
            <div className="org-name">{orgName}</div>
            {orgSub && <div style={{ fontSize: '10pt', color: '#555', marginTop: 2 }}>{orgSub}</div>}
          </div>
          <div className="doc-type">
            <h1>{k.tipe.toUpperCase()}</h1>
            <h2>
              No: <b>{k.no}</b>
            </h2>
            <div style={{ fontSize: '10pt', color: '#555', marginTop: 2 }}>Tanggal: {k.tgl}</div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 10px',
                borderRadius: 20,
                fontSize: '10pt',
                fontWeight: 600,
                background: lunas ? '#DCFCE7' : '#FEF3C7',
                color: lunas ? '#16A34A' : '#92400E',
              }}
            >
              {k.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-row">
            <b>Diterima dari / Kepada:</b>
            <br />
            {k.penerima}
          </div>
          <div className="info-row">
            {k.perusahaan && (
              <>
                <b>Perusahaan:</b>
                <br />
                {k.perusahaan}
              </>
            )}
          </div>
        </div>

        <table className="items-tbl">
          <thead>
            <tr>
              <th style={{ width: 30 }}>No</th>
              <th>Uraian</th>
              <th style={{ width: 60, textAlign: 'center' }}>Qty</th>
              <th style={{ width: 130, textAlign: 'right' }}>Harga</th>
              <th style={{ width: 140, textAlign: 'right' }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'center', color: '#64748B' }}>{i + 1}</td>
                <td>{it.ket}</td>
                <td style={{ textAlign: 'center' }}>{Math.floor(it.qty)}</td>
                <td className="num">{fmtRp(it.harga)}</td>
                <td className="num">{fmtRp(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-box">
          <table>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="num">{fmtRp(k.subtotal)}</td>
              </tr>
              {k.diskon > 0 && (
                <tr>
                  <td style={{ color: '#DC2626' }}>Diskon</td>
                  <td className="num" style={{ color: '#DC2626' }}>
                    - {fmtRp(k.diskon)}
                  </td>
                </tr>
              )}
              {k.ppn > 0 && (
                <tr>
                  <td>PPN</td>
                  <td className="num">{fmtRp(k.ppn)}</td>
                </tr>
              )}
              {k.pph > 0 && (
                <tr>
                  <td style={{ color: '#7C3AED' }}>PPh 23</td>
                  <td className="num" style={{ color: '#7C3AED' }}>
                    - {fmtRp(k.pph)}
                  </td>
                </tr>
              )}
              <tr>
                <td>TOTAL</td>
                <td className="num">Rp {fmtRp(k.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="terbilang">
          <b>Terbilang:</b>{' '}
          {k.terbilang
            ? k.terbilang.charAt(0).toUpperCase() + k.terbilang.slice(1)
            : ''}
        </div>

        {k.catatan && (
          <div
            style={{
              fontSize: '10.5pt',
              color: '#555',
              marginBottom: 14,
              padding: '8px 12px',
              borderLeft: '3px solid #CBD5E1',
            }}
          >
            <b>Catatan:</b> {k.catatan}
          </div>
        )}

        <div className="sign-grid">
          <div className="sign-box">
            <div className="sign-space" />
            Pembuat
            <br />
            <b>{orgName}</b>
          </div>
          <div className="sign-box">
            <div className="sign-space" />
            Mengetahui
            <br />
            <b>Pimpinan</b>
          </div>
          <div className="sign-box">
            <div className="sign-space" />
            Penerima
            <br />
            <b>{k.penerima}</b>
          </div>
        </div>
        <div style={{ fontSize: '9pt', color: '#94A3B8', textAlign: 'right', marginTop: 12 }}>
          Dicetak: {today()}
        </div>
      </div>
    </>
  );
}

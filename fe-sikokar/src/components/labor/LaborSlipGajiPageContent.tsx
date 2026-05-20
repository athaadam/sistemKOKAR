'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type Pekerja = {
  id: string;
  nama: string;
  jabatan: string;
  nik: string;
  jumlah_orang: number;
  biaya: number;
  biaya_lembur: number;
  biaya_tambahan: number;
  pph21: number;
  bpjs_tk?: number;
  bpjs_kes?: number;
  klien: string;
  pekerjaan: string;
};

type TsSummary = {
  hari: number;
  jam: number;
  lembur: number;
  hadir: number;
};

type PrintHeader = {
  header1?: string;
  header2?: string;
  nama_kop?: string;
  alamat?: string;
  logo?: string;
};

export function LaborSlipGajiPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pekerja_id = String(params.pekerja_id || '');
  const bulan = searchParams.get('bulan') || today().slice(0, 7);

  const [p, setP] = useState<Pekerja | null>(null);
  const [ts, setTs] = useState<TsSummary>({ hari: 0, jam: 0, lembur: 0, hadir: 0 });
  const [hdr, setHdr] = useState<PrintHeader>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<{ p: Pekerja; ts: TsSummary; hdr: PrintHeader }>(
        `/labor/slip_gaji/${pekerja_id}?bulan=${bulan}`,
      )
      .then((r) => {
        setP(r.p || null);
        setTs(r.ts || { hari: 0, jam: 0, lembur: 0, hadir: 0 });
        setHdr(r.hdr || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [pekerja_id, bulan]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (err || !p) {
    return (
      <>
        <Flash message={err || 'Tidak ditemukan'} type="danger" />
        <Link href="/labor" className="btn btn-sm btn-secondary">
          ← Kembali
        </Link>
      </>
    );
  }

  const jml = p.jumlah_orang || 1;
  const totalKotor = (p.biaya + p.biaya_lembur + p.biaya_tambahan) * jml;
  const bpjsTk = p.bpjs_tk || 0;
  const bpjsKes = p.bpjs_kes || 0;
  const net = totalKotor - (p.pph21 || 0) - bpjsTk - bpjsKes;

  return (
    <>
      <div className="no-print mb-3 d-flex gap-2">
        <button type="button" className="btn btn-sm btn-navy" onClick={() => window.print()}>
          🖨️ Print
        </button>
        <Link href="/labor" className="btn btn-sm btn-outline-secondary">
          ← Kembali
        </Link>
      </div>

      <div
        style={{
          maxWidth: 700,
          margin: '0 auto',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11pt',
          padding: 24,
        }}
      >
        <div
          className="d-flex border-bottom pb-2 mb-3"
          style={{ borderBottomWidth: 3, borderColor: '#0F2744' }}
        >
          <div className="flex-grow-1">
            <h1 style={{ fontSize: '14pt', color: '#0F2744', margin: 0 }}>
              {hdr.header1 || hdr.nama_kop || 'SIKOKAR'}
            </h1>
            <div style={{ fontSize: '10pt' }}>{hdr.header2 || hdr.alamat}</div>
          </div>
          <div className="text-end">
            <h2 style={{ fontSize: '16pt', color: '#0F2744', margin: 0 }}>SLIP GAJI</h2>
            <div>Bulan: {bulan}</div>
          </div>
        </div>

        <div
          className="mb-3 p-2"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 16px',
            background: '#F8FAFF',
          }}
        >
          <div>
            <b>Nama:</b> {p.nama}
          </div>
          <div>
            <b>Jabatan:</b> {p.jabatan}
          </div>
          <div>
            <b>NIK:</b> {p.nik}
          </div>
          <div>
            <b>Kontrak:</b> {p.klien}
          </div>
          <div>
            <b>Pekerjaan:</b> {p.pekerjaan}
          </div>
          <div>
            <b>Kehadiran:</b> {ts.hadir}/{ts.hari} hari ({ts.jam} jam, lembur {ts.lembur} jam)
          </div>
        </div>

        <table className="table table-sm">
          <tbody>
            <tr>
              <td>Gaji Pokok (Manpower)</td>
              <td className="text-end mono">Rp {fmtRp(p.biaya * jml)}</td>
            </tr>
            <tr>
              <td>Tunjangan Lembur</td>
              <td className="text-end mono">Rp {fmtRp(p.biaya_lembur * jml)}</td>
            </tr>
            <tr>
              <td>Tunjangan Tambahan</td>
              <td className="text-end mono">Rp {fmtRp(p.biaya_tambahan * jml)}</td>
            </tr>
            <tr style={{ background: '#DCFCE7', fontWeight: 'bold' }}>
              <td>TOTAL KOTOR</td>
              <td className="text-end mono">Rp {fmtRp(totalKotor)}</td>
            </tr>
            <tr>
              <td>PPh 21</td>
              <td className="text-end mono text-danger">- Rp {fmtRp(p.pph21 || 0)}</td>
            </tr>
            <tr>
              <td>BPJS Ketenagakerjaan</td>
              <td className="text-end mono text-danger">- Rp {fmtRp(bpjsTk)}</td>
            </tr>
            <tr>
              <td>BPJS Kesehatan</td>
              <td className="text-end mono text-danger">- Rp {fmtRp(bpjsKes)}</td>
            </tr>
            <tr style={{ background: '#0F2744', color: '#fff', fontWeight: 'bold' }}>
              <td>TAKE HOME PAY</td>
              <td className="text-end mono">Rp {fmtRp(net)}</td>
            </tr>
          </tbody>
        </table>

        <div
          className="mt-4 d-flex justify-content-between"
          style={{ marginTop: 30 }}
        >
          <div className="text-center">
            <div style={{ height: 50 }} />
            <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: '10pt' }}>
              Penerima
            </div>
          </div>
          <div className="text-center">
            <div style={{ height: 50 }} />
            <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: '10pt' }}>
              Pembayar
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

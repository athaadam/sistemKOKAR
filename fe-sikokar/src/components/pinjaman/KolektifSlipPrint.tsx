'use client';

import { fmtRp, today } from '@/lib/format';

type PinjamanMini = {
  id?: string;
  jenis?: string;
  nominal?: number;
  tenor?: number;
  angsuran?: number;
  sisa_pokok?: number;
  cicilan_ke?: number;
};

export type SlipData = {
  a: {
    no: string;
    nama: string;
    nip?: string;
    dept?: string;
    jabatan?: string;
    gaji?: number;
  };
  bulan: string;
  toko_rows?: { lokasi_nama?: string; jumlah?: number }[];
  total_toko?: number;
  simpanan_rows?: { label: string; jumlah: number }[];
  total_simpanan?: number;
  pinjaman_regular?: PinjamanMini[];
  pinjaman_darurat?: PinjamanMini[];
  kredit?: { motor?: number; elektronik?: number };
  tunggakan_pin?: number;
  tunggakan_toko?: number;
  total_potongan?: number;
  total_angsuran?: number;
  hdr?: { header1?: string; header2?: string; nama_kop?: string; alamat?: string };
};

export function KolektifSlipPrint({ data, backHref }: { data: SlipData; backHref?: string }) {
  const hdr = data.hdr || {};
  const reg = data.pinjaman_regular?.[0];
  const dar = data.pinjaman_darurat || [];
  const totalToko = Number(data.total_toko) || 0;
  const totalKredit = Number(data.kredit?.motor || 0) + Number(data.kredit?.elektronik || 0);
  const simRows = data.simpanan_rows || [
    { label: 'SIM POKOK', jumlah: 0 },
    { label: 'SIM WAJIB', jumlah: 0 },
    { label: 'SIM SUKARELA', jumlah: 0 },
  ];

  return (
    <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '8pt', padding: 10 }}>
      <style>{`
        .kslip { border: 1px solid #555; margin-bottom: 16px; page-break-after: always; }
        .kslip:last-child { page-break-after: auto; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="no-print mb-2 d-flex gap-2">
        <button type="button" onClick={() => window.print()} className="btn btn-sm btn-navy">
          Print Slip
        </button>
        {backHref && (
          <a href={backHref} className="btn btn-sm btn-outline-secondary">
            Kembali
          </a>
        )}
      </div>

      <div className="kslip p-2">
        <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
          <div>
            <div style={{ fontWeight: 'bold', color: '#0F2744' }}>{hdr.header1 || hdr.nama_kop || 'SIKOKAR'}</div>
            <div style={{ fontSize: '7pt' }}>{hdr.header2 || hdr.alamat}</div>
          </div>
          <div className="text-end">
            <div style={{ fontWeight: 'bold' }}>LIST POTONGAN GAJI</div>
            <div>BULAN: {data.bulan}</div>
          </div>
        </div>

        <div className="row g-2 mb-2" style={{ fontSize: '8pt' }}>
          <div className="col-6">
            <div>
              <b>No:</b> {data.a.no} · <b>Nama:</b> {data.a.nama}
            </div>
            <div>
              <b>NIP:</b> {data.a.nip} · <b>Dept:</b> {data.a.dept}
            </div>
          </div>
          <div className="col-6 text-end">
            <div>
              <b>Gaji:</b> Rp {fmtRp(data.a.gaji)}
            </div>
          </div>
        </div>

        <table className="table table-sm table-bordered mb-2" style={{ fontSize: '7.5pt' }}>
          <thead>
            <tr style={{ background: '#0F2744', color: '#fff' }}>
              <th>Potongan Toko</th>
              <th className="text-end">Jumlah</th>
              <th>Simpanan (saldo)</th>
              <th className="text-end">Jumlah</th>
              <th>Pinjaman</th>
              <th className="text-end">Angsuran/bln</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{(data.toko_rows || []).map((t) => t.lokasi_nama).filter(Boolean).join(' / ') || 'Toko / POS'}</td>
              <td className="text-end mono">{fmtRp(totalToko)}</td>
              <td rowSpan={2}>{simRows.map((s) => `${s.label}: ${fmtRp(s.jumlah)}`).join(' · ')}</td>
              <td rowSpan={2} className="text-end mono">
                {fmtRp(data.total_simpanan)}
              </td>
              <td>REGULAR</td>
              <td className="text-end mono">{reg ? fmtRp(reg.angsuran) : '—'}</td>
            </tr>
            <tr>
              <td>Kredit Motor & Elektronik</td>
              <td className="text-end mono">{fmtRp(totalKredit)}</td>
              <td colSpan={2}>
                {dar.map((d, i) => (
                  <span key={d.id || i} className="me-2">
                    Darurat{i + 1}: {fmtRp(d.angsuran)}
                  </span>
                ))}
              </td>
            </tr>
            <tr className="fw-bold" style={{ background: '#DCFCE7' }}>
              <td colSpan={2} className="text-end">
                Total Toko: {fmtRp(totalToko)}
              </td>
              <td colSpan={2} className="text-end">
                Total Simpanan: {fmtRp(data.total_simpanan)}
              </td>
              <td>GRAND TOTAL</td>
              <td className="text-end mono">{fmtRp(data.total_potongan)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '7pt', color: '#aaa', textAlign: 'right' }}>Dicetak: {today()}</div>
    </div>
  );
}

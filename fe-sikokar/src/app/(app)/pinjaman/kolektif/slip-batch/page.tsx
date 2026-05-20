'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { bulanIni } from '@/lib/format';
import { KolektifSlipPrint, type SlipData } from '@/components/pinjaman/KolektifSlipPrint';

type BatchSlipRaw = {
  a: SlipData['a'];
  toko_rows?: SlipData['toko_rows'];
  total_toko?: number;
  simpanan_rows?: SlipData['simpanan_rows'];
  total_sim?: number;
  pinjaman_regular?: SlipData['pinjaman_regular'];
  pinjaman_darurat?: SlipData['pinjaman_darurat'];
  kredit?: SlipData['kredit'];
  tung_toko?: number;
  tung_pin?: number;
  total_potongan?: number;
};

function SlipBatchInner() {
  const searchParams = useSearchParams();
  const bulan = searchParams.get('bulan') || bulanIni();
  const ids = searchParams.get('ids') || '';
  const [slips, setSlips] = useState<SlipData[]>([]);
  const [hdr, setHdr] = useState<SlipData['hdr']>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ids) {
      setErr('Tidak ada anggota dipilih');
      return;
    }
    api
      .get<{ slips: BatchSlipRaw[]; hdr: SlipData['hdr']; bulan: string }>(
        `/pinjaman/kolektif/slip_batch?bulan=${encodeURIComponent(bulan)}&ids=${encodeURIComponent(ids)}`,
      )
      .then((r) => {
        setHdr(r.hdr);
        setSlips(
          (r.slips || []).map((s) => ({
            a: s.a,
            bulan: r.bulan || bulan,
            toko_rows: s.toko_rows,
            total_toko: s.total_toko,
            simpanan_rows: s.simpanan_rows,
            total_simpanan: s.total_sim,
            pinjaman_regular: s.pinjaman_regular,
            pinjaman_darurat: s.pinjaman_darurat,
            kredit: s.kredit,
            tunggakan_pin: s.tung_pin,
            tunggakan_toko: s.tung_toko,
            total_potongan: s.total_potongan,
            hdr: r.hdr,
          })),
        );
      })
      .catch((e) => setErr(e.message));
  }, [bulan, ids]);

  if (err) return <div className="p-4 text-danger">{err}</div>;
  if (!slips.length) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <div>
      <div className="no-print p-2 d-flex gap-2">
        <button type="button" onClick={() => window.print()} className="btn btn-sm btn-navy">
          Print Semua Slip
        </button>
        <a href={`/pinjaman/kolektif?bulan=${bulan}`} className="btn btn-sm btn-outline-secondary">
          Kembali
        </a>
      </div>
      {slips.map((s, i) => (
        <KolektifSlipPrint key={`${s.a.no}-${i}`} data={{ ...s, hdr: hdr || s.hdr }} />
      ))}
    </div>
  );
}

function SlipBatchFallback() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border" />
    </div>
  );
}

export default function KolektifSlipBatchPage() {
  return (
    <Suspense fallback={<SlipBatchFallback />}>
      <SlipBatchInner />
    </Suspense>
  );
}

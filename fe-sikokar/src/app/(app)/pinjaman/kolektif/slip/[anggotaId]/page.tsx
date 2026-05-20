'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { bulanIni } from '@/lib/format';
import { KolektifSlipPrint, type SlipData } from '@/components/pinjaman/KolektifSlipPrint';

export default function KolektifSlipAnggotaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const anggotaId = String(params.anggotaId || '');
  const bulan = searchParams.get('bulan') || bulanIni();
  const [data, setData] = useState<SlipData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!anggotaId) return;
    api
      .get<SlipData & { hdr?: SlipData['hdr'] }>(`/pinjaman/kolektif/slip/${anggotaId}?bulan=${encodeURIComponent(bulan)}`)
      .then((r) => {
        setData({
          a: r.a,
          bulan: r.bulan || bulan,
          toko_rows: r.toko_rows,
          total_toko: r.total_toko,
          simpanan_rows: r.simpanan_rows,
          total_simpanan: r.total_simpanan,
          pinjaman_regular: r.pinjaman_regular,
          pinjaman_darurat: r.pinjaman_darurat,
          kredit: r.kredit,
          tunggakan_pin: r.tunggakan_pin,
          tunggakan_toko: r.tunggakan_toko,
          total_potongan: r.total_potongan,
          total_angsuran: r.total_angsuran,
          hdr: r.hdr,
        });
      })
      .catch((e) => setErr(e.message));
  }, [anggotaId, bulan]);

  if (err) return <div className="p-4 text-danger">{err}</div>;
  if (!data) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return <KolektifSlipPrint data={data} backHref={`/pinjaman/kolektif?bulan=${bulan}`} />;
}

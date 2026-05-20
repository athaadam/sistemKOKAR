'use client';

import Link from 'next/link';
import { today } from '@/lib/format';

const btnStyle = { borderRadius: 6, fontSize: 11 };

export function PembukuanSubNav({ tahun }: { tahun?: string }) {
  const y = tahun || today().slice(0, 4);
  return (
    <div className="d-flex flex-wrap gap-1 mb-2 no-print" style={{ fontSize: 11 }}>
      <Link href="/pembukuan/ledger" className="btn btn-sm btn-outline-info" style={btnStyle}>
        Buku Besar
      </Link>
      <Link href="/pembukuan/trial-balance" className="btn btn-sm btn-outline-info" style={btnStyle}>
        Neraca Saldo
      </Link>
      <Link href={`/pembukuan/arus-kas?tahun=${y}`} className="btn btn-sm btn-outline-info" style={btnStyle}>
        Arus Kas
      </Link>
      <Link href={`/pembukuan/calk?tahun=${y}`} className="btn btn-sm btn-outline-info" style={btnStyle}>
        CALK
      </Link>
      <Link href="/aset" className="btn btn-sm btn-outline-info" style={btnStyle}>
        Aset Tetap
      </Link>
      <Link href="/pembukuan/close-period" className="btn btn-sm btn-outline-warning" style={btnStyle}>
        Tutup Buku
      </Link>
    </div>
  );
}

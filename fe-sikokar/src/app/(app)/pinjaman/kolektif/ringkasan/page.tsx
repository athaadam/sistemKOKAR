'use client';

import { Suspense } from 'react';
import { PinjamanKolektifRingkasanPageContent } from '@/components/pinjaman/PinjamanKolektifRingkasanPageContent';

function RingkasanFallback() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border" />
    </div>
  );
}

export default function PinjamanKolektifRingkasanPage() {
  return (
    <Suspense fallback={<RingkasanFallback />}>
      <PinjamanKolektifRingkasanPageContent />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { LaporanPageContent } from '@/components/laporan/LaporanPageContent';

export default function LaporanPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <LaporanPageContent />
    </Suspense>
  );
}

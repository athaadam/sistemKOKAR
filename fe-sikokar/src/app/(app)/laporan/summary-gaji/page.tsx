'use client';

import { Suspense } from 'react';
import { SummaryGajiPageContent } from '@/components/laporan/SummaryGajiPageContent';

export default function SummaryGajiPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <SummaryGajiPageContent />
    </Suspense>
  );
}

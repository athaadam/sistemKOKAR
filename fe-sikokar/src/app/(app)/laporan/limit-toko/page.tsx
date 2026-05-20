'use client';

import { Suspense } from 'react';
import { LimitTokoPageContent } from '@/components/laporan/LimitTokoPageContent';

export default function LimitTokoPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <LimitTokoPageContent />
    </Suspense>
  );
}

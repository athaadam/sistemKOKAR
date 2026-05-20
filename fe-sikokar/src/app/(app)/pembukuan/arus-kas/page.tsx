'use client';

import { Suspense } from 'react';
import { PembukuanArusKasPageContent } from '@/components/pembukuan/PembukuanArusKasPageContent';

export default function PembukuanArusKasPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <PembukuanArusKasPageContent />
    </Suspense>
  );
}

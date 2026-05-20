'use client';

import { Suspense } from 'react';
import { KonsolidasiPageContent } from '@/components/konsolidasi/KonsolidasiPageContent';

export default function KonsolidasiPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <KonsolidasiPageContent />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { PembukuanCalkPageContent } from '@/components/pembukuan/PembukuanCalkPageContent';

export default function PembukuanCalkPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <PembukuanCalkPageContent />
    </Suspense>
  );
}

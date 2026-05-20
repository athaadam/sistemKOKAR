'use client';

import { Suspense } from 'react';
import { LaborSlipGajiPageContent } from '@/components/labor/LaborSlipGajiPageContent';

export default function LaborSlipPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-5">
          <div className="spinner-border" />
        </div>
      }
    >
      <LaborSlipGajiPageContent />
    </Suspense>
  );
}

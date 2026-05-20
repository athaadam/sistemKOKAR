'use client';

import { Suspense } from 'react';
import { SettingPageContent } from '@/components/setting/SettingPageContent';

export default function SettingPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><div className="spinner-border" /></div>}>
      <SettingPageContent />
    </Suspense>
  );
}

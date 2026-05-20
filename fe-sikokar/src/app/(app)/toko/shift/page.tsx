'use client';

import { PageLoader } from '@/components/PageLoader';
import { DataTable } from '@/components/DataTable';

export default function tokoshiftPage() {
  return (
    <PageLoader title="Shift Kasir" endpoint="/toko/shift">
      {(data, reload) => (
        <DataTable
          rows={(data.history as Record<string, unknown>[]) || (data.rows as Record<string, unknown>[]) || []}
          exportPath="/toko/shift/export"
          onRefresh={reload}
        />
      )}
    </PageLoader>
  );
}

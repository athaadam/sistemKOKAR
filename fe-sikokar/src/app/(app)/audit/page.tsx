'use client';

import { PageLoader } from '@/components/PageLoader';
import { DataTable } from '@/components/DataTable';

export default function auditPage() {
  return (
    <PageLoader title="Audit Log" endpoint="/audit">
      {(data, reload) => (
        <DataTable
          rows={(data.rows as Record<string, unknown>[]) || (data.rows as Record<string, unknown>[]) || []}
          exportPath="/audit/export"
          onRefresh={reload}
        />
      )}
    </PageLoader>
  );
}

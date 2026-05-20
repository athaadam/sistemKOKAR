'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Flash } from '@/components/ui/Flash';

type Props = {
  title: string;
  endpoint: string;
  query?: Record<string, string>;
  children: (data: Record<string, unknown>, reload: () => void) => React.ReactNode;
};

export function PageLoader({ title, endpoint, query, children }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';

  function load() {
    setLoading(true);
    setErr('');
    api
      .get<Record<string, unknown>>(`${endpoint}${qs}`)
      .then((r) => setData(r))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, qs]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;
  if (!data) return null;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">{title}</h2>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load}>
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>
      {children(data, load)}
    </>
  );
}

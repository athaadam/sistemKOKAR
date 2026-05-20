'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getMe, type User } from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => {
        if (!u) router.replace('/login');
        else setUser(u);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) return null;

  const title = pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Dashboard';

  return (
    <MainLayout user={user} title={title.charAt(0).toUpperCase() + title.slice(1)}>
      {children}
    </MainLayout>
  );
}

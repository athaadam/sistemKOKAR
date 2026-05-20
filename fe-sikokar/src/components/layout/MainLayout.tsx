'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import type { User } from '@/lib/api';
import { today } from '@/lib/format';

export function MainLayout({
  user,
  title,
  children,
}: {
  user: User;
  title: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar user={user} isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <main id="main">
        <header className="topbar">
          <button
            type="button"
            className="btn-menu"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Menu"
            title="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="topbar-title">{title}</div>
          <div className="ms-auto d-flex align-items-center gap-3">
            <span className="badge bg-light text-secondary border d-none d-md-inline-flex">
              <i className="bi bi-calendar3 me-2" />
              {today()}
            </span>
            <span className="badge bg-light text-secondary">
              <i className="bi bi-person-circle me-2" />
              {user.name}
            </span>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
      {sidebarOpen && (
        <div
          role="presentation"
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <style jsx global>{`
        @media (max-width: 768px) {
          #sidebar {
            transform: translateX(${sidebarOpen ? '0' : '-100%'});
          }
        }
      `}</style>
    </>
  );
}

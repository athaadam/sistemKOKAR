'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MENU_TREE, ROLE_LABELS, canAccess, menuHref, type MenuItem } from '@/lib/menu';
import { logout, type User } from '@/lib/api';

export function Sidebar({ user, isOpen, onNavigate }: { user: User; isOpen?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (menuId: string) => {
    const href = menuHref(menuId);
    return pathname === href || pathname.startsWith(href + '/');
  };

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <nav id="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-ico">🏛️</div>
        <div>
          <div className="sb-logo-name">SIKOKAR</div>
          <span className="sb-version">v1.5</span>
        </div>
      </div>

      {MENU_TREE.map(({ section, items }) => {
        const visible = items.filter((it) => canAccess(user, it.id));
        if (!visible.length) return null;
        return (
          <div key={section}>
            <div className="sb-section">{section}</div>
            {visible.map((it: MenuItem) => (
              <Link
                key={it.id}
                href={menuHref(it.id)}
                className={`sb-item ${isActive(it.id) ? 'active' : ''}`}
                onClick={onNavigate}
              >
                <i className={`bi ${it.icon}`} />
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        );
      })}

      <div className="sb-footer">
        <div className="sb-user-card">
          <div className="sb-user-name">{user.name}</div>
          <div className="sb-user-role">{ROLE_LABELS[user.role] || user.role}</div>
        </div>
        <button
          type="button"
          className="sb-item sb-logout"
          onClick={handleLogout}
        >
          <i className="bi bi-box-arrow-left" />
          <span>Keluar</span>
        </button>
      </div>

      <style jsx>{`
        .sb-version {
          font-size: 10px;
          color: var(--text-secondary);
          background: rgba(66, 165, 245, 0.1);
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 600;
        }

        .sb-footer {
          margin-top: auto;
          padding: 12px 12px 16px;
          border-top: 1px solid var(--neutral-border);
        }

        .sb-user-card {
          padding: 12px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(66, 165, 245, 0.08), rgba(0, 188, 212, 0.08));
          margin-bottom: 8px;
          border: 1px solid rgba(66, 165, 245, 0.1);
        }

        .sb-user-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .sb-user-role {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 3px;
        }

        .sb-logout:hover {
          background: #FFE5E5;
          color: var(--accent);
        }
      `}</style>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MENU_TREE, ROLE_LABELS, canAccess, menuHref, type MenuItem } from '@/lib/menu';
import { logout, type User } from '@/lib/api';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

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
        <div className="sb-logo-ico">
          <IconRenderer icon={ICON_MAP.landmark_custom} size={28} />
        </div>
        <div>
          <div className="sb-logo-name">SIKOKAR</div>
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
                <IconRenderer icon={it.icon} size={18} />
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
          <IconRenderer icon={ICON_MAP.logout} size={18} />
          <span>Keluar</span>
        </button>
      </div>

      <style jsx>{`
        #sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          width: var(--sb-w);
          background: linear-gradient(135deg, #87CEFA 0%, #5DADE2 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          z-index: 200;
          transition: var(--transition);
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
        }

        .sb-logo {
          padding: 16px 18px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sb-logo-ico {
          width: 38px;
          height: 38px;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .sb-logo-name {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
        }

        .sb-section {
          padding: 12px 18px 6px;
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(15, 23, 42, 0.7);
        }

        :global(.sb-item) {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          margin: 2px 12px;
          border-radius: 8px;
          color: #0f172a;
          font-size: 12.5px;
          font-weight: 500;
          text-decoration: none;
          transition: var(--transition);
          position: relative;
          border-left: 3px solid transparent;
          border: none;
          background: transparent;
          cursor: pointer;
        }

        :global(.sb-item:hover) {
          background: #fff;
          color: #0f172a;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        :global(.sb-item.active) {
          background: #fff;
          color: #0f172a;
          font-weight: 600;
          border-left-color: #0f172a;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
        }

        :global(.sb-item svg) {
          flex-shrink: 0;
        }

        .sb-footer {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }

        .sb-user-card {
          padding: 10px 14px;
          margin-bottom: 8px;
        }

        .sb-user-name {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2px;
        }

        .sb-user-role {
          font-size: 10.5px;
          color: rgba(15, 23, 42, 0.7);
          font-weight: 500;
        }

        .sb-logout {
          justify-content: flex-start;
        }

        .sb-logout:hover {
          background: #fff;
          color: #b91c1c;
        }

        #sidebar::-webkit-scrollbar {
          width: 6px;
        }

        #sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        #sidebar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.25);
          border-radius: 3px;
        }

        #sidebar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </nav>
  );
}

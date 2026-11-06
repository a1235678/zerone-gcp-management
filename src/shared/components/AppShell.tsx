import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface ShellUser {
  name: string;
  role: string;
  email: string;
}

/**
 * 三個網站共用的外框：左側選單、頂列、內容區。
 * 各網站只傳入自己的選單、網站名稱與目前使用者。
 */
export function AppShell({
  siteName,
  siteSubtitle,
  nav,
  user,
  onLogout,
  children,
}: {
  siteName: string;
  siteSubtitle: string;
  nav: NavGroup[];
  user: ShellUser;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 點選單以外的地方或按 Esc 關閉使用者選單
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const current = findCurrent(nav, location.pathname);

  return (
    <div className={`shell ${open ? 'is-nav-open' : ''}`}>
      <aside className="sidebar" aria-label="主選單">
        <div className="sidebar__brand">
          <span className="sidebar__logo">01</span>
          <div>
            <div className="sidebar__title">{siteName}</div>
            <div className="sidebar__subtitle">{siteSubtitle}</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          {nav.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group__label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">Prototype v0.1 · 資料皆為假資料</div>
      </aside>
      <div className="overlay" onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="btn btn--ghost btn--icon topbar__menu" aria-label="開啟選單" onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="topbar__crumbs">
            {current ? (
              <>
                <span>{current.group}</span>
                <Icon name="chevronRight" size={14} />
                <strong>{current.label}</strong>
              </>
            ) : null}
          </div>
          <div className="topbar__spacer" />
          <span className="topbar__env" title="此網站僅供需求確認，未連接任何後端或 Google API">
            <Icon name="info" size={13} />
            <span className="topbar__env-text">Prototype · 假資料</span>
          </span>
          <div className="user-menu" ref={menuRef}>
            <button type="button" className="topbar__user" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <span className="topbar__user-meta">
                <span>{user.name}</span>
                <span className="topbar__user-role">{user.role}</span>
              </span>
              <Icon name="chevronDown" size={14} className="topbar__user-caret" />
            </button>
            {menuOpen && (
              <div className="user-menu__panel" role="menu">
                <div className="user-menu__head">
                  <strong>{user.name}</strong>
                  <span className="muted">{user.role}</span>
                  <span className="mono muted">{user.email}</span>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu__item"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <Icon name="logout" size={16} />
                  登出
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function findCurrent(nav: NavGroup[], pathname: string) {
  let best: { group: string; label: string; len: number } | undefined;
  for (const g of nav) {
    for (const item of g.items) {
      const match = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/');
      if (match && (!best || item.to.length > best.len)) best = { group: g.label, label: item.label, len: item.to.length };
    }
  }
  return best;
}

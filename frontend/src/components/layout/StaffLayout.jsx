import { useEffect, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, Menu, Moon, Sun, UserCircle2, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth.js';
import { useTheme } from '../../context/useTheme.js';
import { useToast } from '../../context/useToast.js';
import Logo from '../ui/Logo.jsx';
import './StaffLayout.css';

const staffItems = [
  { to: '/staff', label: 'Dashboard' },
  { to: '/staff/reports', label: 'Reports' },
  { to: '/staff/cases', label: 'Cases' },
  { to: '/staff/matches', label: 'Matches' },
];

const adminItems = [
  { to: '/staff/admin/users', label: 'Users' },
  { to: '/staff/admin/officers', label: 'Officers' },
];

export function StaffLayout({ children }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { effectiveTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('ia-staff-sidebar');
    return saved === 'collapsed';
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ia-staff-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  const visibleItems = user?.role === 'admin' ? [...staffItems, ...adminItems] : staffItems;

  const handleLogout = async () => {
    try {
      await logout();
      setAccountOpen(false);
    } catch {
      toast({ message: 'Could not log out. Please try again.', type: 'error' });
    }
  };

  return (
    <div className="staff-layout">
      <header className="staff-header">
        <div className="staff-header__left">
          <span className="staff-header__mark">STAFF</span>
          <div className="staff-header__brand">
            <Logo size={24} showWordmark={false} />
          </div>
        </div>

        <div className="staff-header__right">
          <button type="button" className="staff-icon-btn" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <button type="button" className="staff-icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
            {effectiveTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="staff-account-menu">
            <button
              type="button"
              className="staff-account-btn"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <UserCircle2 size={18} />
              <span>{user?.name || 'Staff'}</span>
            </button>
            {accountOpen && (
              <div className="staff-account-dropdown" role="menu">
                <div className="staff-account-dropdown__identity">
                  <strong>{user?.name || 'Staff'}</strong>
                  <span>{user?.role}</span>
                </div>
                <Link role="menuitem" to="/home" onClick={() => setAccountOpen(false)}>Public site</Link>
                <button role="menuitem" type="button" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="staff-shell">
        <aside className={`staff-sidebar ${collapsed ? 'staff-sidebar--collapsed' : ''}`}>
          <button type="button" className="staff-sidebar__collapse" onClick={() => setCollapsed((value) => !value)} aria-label="Collapse sidebar">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <nav aria-label="Staff navigation" className="staff-sidebar__nav">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `staff-nav-item ${isActive ? 'staff-nav-item--active' : ''}`}
              >
                <span className="staff-nav-item__label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <button type="button" className="staff-drawer-toggle" aria-label="Open staff menu" onClick={() => setDrawerOpen(true)}>
          <Menu size={18} />
        </button>

        <main className="staff-main">{children}</main>
      </div>

      <div className={`staff-drawer-overlay ${drawerOpen ? 'staff-drawer-overlay--open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`staff-drawer ${drawerOpen ? 'staff-drawer--open' : ''}`} aria-label="Mobile staff menu">
        <button type="button" className="staff-drawer__close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `staff-nav-item ${isActive ? 'staff-nav-item--active' : ''}`}
            onClick={() => setDrawerOpen(false)}
          >
            <span className="staff-nav-item__label">{item.label}</span>
          </NavLink>
        ))}
      </aside>
    </div>
  );
}

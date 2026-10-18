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

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [systemNoticeDismissed, setSystemNoticeDismissed] = useState(false);

  const mockNotifications = [
    {
      id: 'notif-1',
      type: 'report_assigned',
      title: 'Report Assigned',
      desc: 'Report REF-20260920-001 assigned to Inspector Rajan Verma.',
      time: '10m ago',
      to: '/staff/reports/rep-002',
    },
    {
      id: 'notif-2',
      type: 'info_provided',
      title: 'Information Provided',
      desc: 'Additional details submitted for REF-20260922-001.',
      time: '45m ago',
      to: '/staff/reports/rep-003',
    },
    {
      id: 'notif-3',
      type: 'match_pending',
      title: 'Potential Match Pending',
      desc: 'High confidence match (91%) pending review.',
      time: '2h ago',
      to: '/staff/matches/match-001',
    },
  ];

  return (
    <div className="staff-layout">
      <header className="staff-header">
        <div className="staff-header__left">
          <span className="staff-header__mark">STAFF</span>
          <div className="staff-header__brand">
            <Logo size={42} className="logo--staff" />
          </div>
        </div>

        <div className="staff-header__right">
          {/* Notifications Bell */}
          <div className="staff-notifications-menu">
            <button
              type="button"
              className="staff-icon-btn staff-bell-btn"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen(o => !o);
                setAccountOpen(false);
              }}
            >
              <Bell size={16} />
              <span className="staff-bell-badge" aria-hidden="true">{mockNotifications.length}</span>
            </button>
            {notificationsOpen && (
              <div className="staff-notifications-dropdown" role="region" aria-label="Recent notifications">
                <div className="staff-notifications-header">
                  <strong>Notifications</strong>
                  <span className="staff-notifications-count">{mockNotifications.length} recent</span>
                </div>
                <div className="staff-notifications-list">
                  {mockNotifications.map(n => (
                    <Link
                      key={n.id}
                      to={n.to}
                      className="staff-notification-item"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <div className="staff-notification-item__title">{n.title}</div>
                      <div className="staff-notification-item__desc">{n.desc}</div>
                      <div className="staff-notification-item__time">{n.time}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button type="button" className="staff-icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
            {effectiveTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="staff-account-menu">
            <button
              type="button"
              className="staff-account-btn"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={() => {
                setAccountOpen((open) => !open);
                setNotificationsOpen(false);
              }}
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

        <main className="staff-main">
          {/* Top-of-page System Notices Banner Area */}
          {!systemNoticeDismissed && (
            <div className="staff-system-notice-bar" role="region" aria-label="System Notice">
              <div className="staff-system-notice-content">
                <span className="staff-system-notice-tag">NOTICE</span>
                <span className="staff-system-notice-text">
                  Scheduled platform database synchronization tonight at 02:00 IST. Emergency helplines (112, 1098, 181, 1930) remain permanently active.
                </span>
              </div>
              <button
                type="button"
                className="staff-system-notice-dismiss"
                onClick={() => setSystemNoticeDismissed(true)}
                aria-label="Dismiss system notice"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {children}
        </main>
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

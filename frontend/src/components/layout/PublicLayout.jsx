import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth.js';
import { useTheme } from '../../context/useTheme.js';
import { useToast } from '../../context/useToast.js';
import Logo from '../ui/Logo.jsx';
import './PublicLayout.css';

const NAV_ITEMS = [
  { to: '/home', label: 'Home' },
  { to: '/cases', label: 'Browse Cases' },
  { to: '/report/new', label: 'Report' },
  { to: '/track', label: 'Track Report' },
  { to: '/safety', label: 'Safety & FAQ' },
];

export function PublicLayout({ children }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { effectiveTheme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setAccountOpen(false);
    } catch {
      toast({ message: 'Could not log out. Please try again.', type: 'error' });
    }
  };

  return (
    <div className="pub-layout">
      <header>
        <div className="pub-topbar">
          <div className="pub-topbar__inner">
            <div className="pub-topbar__helpline">
              <span>Emergency</span>
              <span className="pub-topbar__helpline-number">112</span>
            </div>
            <div className="pub-topbar__actions">
              <button
                type="button"
                className="pub-topbar__theme-btn"
                aria-label="Toggle theme"
                onClick={toggleTheme}
              >
                {effectiveTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </div>

        <nav className="pub-navbar" aria-label="Main navigation">
          <div className="pub-navbar__inner">
            <Logo size={30} showWordmark={false} />

            <div className="pub-navbar__nav">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `pub-nav-link${isActive ? ' active' : ''}`}>
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="pub-navbar__auth">
              {!user ? (
                <>
                  <Link to="/login" className="btn btn--outline btn--sm">Log in</Link>
                  <Link to="/register" className="btn btn--solid btn--sm">Register</Link>
                </>
              ) : (
                <div className="pub-account-menu">
                  <button
                    type="button"
                    className="pub-account-btn"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    onClick={() => setAccountOpen((open) => !open)}
                  >
                    <span>{user.name || 'Account'}</span>
                    <ChevronDown size={14} />
                  </button>
                  {accountOpen && (
                    <div className="pub-account-dropdown" role="menu">
                      <div className="pub-account-dropdown__identity">
                        <strong>{user.name || 'Account'}</strong>
                        <span>{user.role}</span>
                      </div>
                      {user.role === 'individual' && (
                        <Link role="menuitem" to="/my-reports" onClick={() => setAccountOpen(false)}>My reports</Link>
                      )}
                      <Link role="menuitem" to="/track" onClick={() => setAccountOpen(false)}>Track report</Link>
                      <button role="menuitem" type="button" onClick={handleLogout}>Log out</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="pub-navbar__hamburger"
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </nav>
      </header>

      <main className="pub-layout__content">{children}</main>

      <footer className="pub-footer">
        <div className="pub-footer__helpline-strip">
          <div className="pub-footer__helpline-strip-inner">
            <div className="pub-footer__helpline-item"><span>112</span></div>
            <div className="pub-footer__helpline-item"><span>1098</span><span>Child helpline</span></div>
            <div className="pub-footer__helpline-item"><span>181</span><span>Women helpline</span></div>
            <div className="pub-footer__helpline-item"><span>1930</span><span>Cybercrime</span></div>
          </div>
        </div>

        <div className="pub-footer__main">
          <div>
            <div className="pub-footer__col-title">About</div>
            <div className="pub-footer__links">
              <Link to="/home">Overview</Link>
              <Link to="/cases">Browse cases</Link>
            </div>
          </div>
          <div>
            <div className="pub-footer__col-title">How it works</div>
            <div className="pub-footer__links">
              <Link to="/report/new">Report</Link>
              <Link to="/track">Track report</Link>
            </div>
          </div>
          <div>
            <div className="pub-footer__col-title">Safety</div>
            <div className="pub-footer__links">
              <Link to="/safety">Safety & FAQ</Link>
              <Link to="/safety">Emergency contacts</Link>
            </div>
          </div>
          <div>
            <div className="pub-footer__col-title">Privacy</div>
            <div className="pub-footer__links">
              <Link to="/safety">Privacy note</Link>
              <Link to="/login">Staff login</Link>
            </div>
          </div>
        </div>

        <div className="pub-footer__bottom">
          <span>© 2026 IdentArchive</span>
          <span className="pub-footer__note">Every detail on record.</span>
        </div>
      </footer>

      <div className={`pub-drawer-overlay ${drawerOpen ? 'pub-drawer-overlay--open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`pub-drawer ${drawerOpen ? 'pub-drawer--open' : ''}`} aria-label="Mobile menu">
        <button type="button" className="pub-drawer__close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `pub-nav-link${isActive ? ' active' : ''}`} onClick={() => setDrawerOpen(false)}>
            {item.label}
          </NavLink>
        ))}
        {!user ? (
          <>
            <Link to="/login" className="pub-nav-link" onClick={() => setDrawerOpen(false)}>Log in</Link>
            <Link to="/register" className="pub-nav-link" onClick={() => setDrawerOpen(false)}>Register</Link>
          </>
        ) : (
          <>
            <div className="pub-drawer__identity">
              <strong>{user.name || 'Account'}</strong>
              <span>{user.role}</span>
            </div>
            {user.role === 'individual' && (
              <Link to="/my-reports" className="pub-nav-link" onClick={() => setDrawerOpen(false)}>My reports</Link>
            )}
            <button type="button" className="pub-nav-link" onClick={() => { setDrawerOpen(false); handleLogout(); }}>Log out</button>
          </>
        )}
      </aside>
    </div>
  );
}

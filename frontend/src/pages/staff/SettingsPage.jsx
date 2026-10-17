import { useAuth } from '../../context/useAuth.js';
import { useTheme } from '../../context/useTheme.js';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <StaffLayout>
      <div style={{ display: 'grid', gap: 'var(--sp-5)', maxWidth: '64rem' }}>
        <header>
          <h1>Staff settings</h1>
          <p style={{ color: 'var(--muted)' }}>Review your demo account and interface preferences.</p>
        </header>

        <section
          aria-labelledby="staff-account-heading"
          style={{ display: 'grid', gap: 'var(--sp-3)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)' }}
        >
          <h2 id="staff-account-heading">Account</h2>
          <p><strong>Name:</strong> {user?.name || 'Unavailable'}</p>
          <p><strong>Email:</strong> {user?.email || 'Unavailable'}</p>
          <p><strong>Role:</strong> {user?.role || 'Unavailable'}</p>
          {user?.officerId && <p><strong>Officer ID:</strong> {user.officerId}</p>}
        </section>

        <section
          aria-labelledby="staff-preferences-heading"
          style={{ display: 'grid', gap: 'var(--sp-3)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)' }}
        >
          <h2 id="staff-preferences-heading">Appearance</h2>
          <label htmlFor="staff-theme">Color theme</label>
          <select
            id="staff-theme"
            value={theme || 'system'}
            onChange={(event) => setTheme(event.target.value === 'system' ? null : event.target.value)}
            style={{ width: 'fit-content', minWidth: '12rem' }}
          >
            <option value="system">Use system preference</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </section>
      </div>
    </StaffLayout>
  );
}

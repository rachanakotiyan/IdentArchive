import { PublicLayout } from '../components/layout/PublicLayout.jsx';
import { StaffLayout } from '../components/layout/StaffLayout.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

function PlaceholderShell({ title, description, layout = 'public' }) {
  const Layout = layout === 'staff' ? StaffLayout : PublicLayout;

  useDocumentTitle(title);

  return (
    <Layout>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: '2rem',
        display: 'grid',
        gap: '0.75rem',
      }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {layout === 'staff' ? 'Staff area' : 'Public route'}
        </p>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '50ch', lineHeight: '1.6' }}>{description}</p>
      </div>
    </Layout>
  );
}

export default function PlaceholderPage({ title = 'Placeholder', description = 'This page is a placeholder.', layout = 'public' }) {
  return <PlaceholderShell title={title} description={description} layout={layout} />;
}

export function PublicPlaceholderPage({ title, description }) {
  return <PlaceholderShell title={title} description={description} layout="public" />;
}

export function StaffPlaceholderPage({ title, description }) {
  return <PlaceholderShell title={title} description={description} layout="staff" />;
}

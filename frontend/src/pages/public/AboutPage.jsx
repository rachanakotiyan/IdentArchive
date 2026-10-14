import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function AboutPage() {
  useDocumentTitle('About');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>About</h1>
        <p>Public about placeholder.</p>
      </div>
    </PublicLayout>
  );
}

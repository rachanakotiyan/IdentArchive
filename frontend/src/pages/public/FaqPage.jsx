import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function FaqPage() {
  useDocumentTitle('FAQ');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>FAQ</h1>
        <p>Public FAQ placeholder.</p>
      </div>
    </PublicLayout>
  );
}

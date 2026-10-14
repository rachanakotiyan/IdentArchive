import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../PlaceholderPage.jsx';

export default function MyReportsPage() {
  useDocumentTitle('My reports');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>My reports</h1>
        <p>Public user reports placeholder.</p>
      </div>
    </PublicLayout>
  );
}

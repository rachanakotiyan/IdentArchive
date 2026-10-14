import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../PlaceholderPage.jsx';

export default function HomePage() {
  useDocumentTitle('Home');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Home</h1>
        <p>Public home placeholder.</p>
      </div>
    </PublicLayout>
  );
}

import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../PlaceholderPage.jsx';

export default function LoginPage() {
  useDocumentTitle('Log in');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Log in</h1>
        <p>Public login placeholder.</p>
      </div>
    </PublicLayout>
  );
}

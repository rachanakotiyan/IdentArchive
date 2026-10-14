import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../PlaceholderPage.jsx';

export default function AuthPage() {
  useDocumentTitle('Account');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Account</h1>
        <p>Auth entry placeholder.</p>
      </div>
    </PublicLayout>
  );
}

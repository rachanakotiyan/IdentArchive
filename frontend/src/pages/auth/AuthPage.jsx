import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

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

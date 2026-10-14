import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../PlaceholderPage.jsx';

export default function RegisterPage() {
  useDocumentTitle('Register');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Register</h1>
        <p>Public registration placeholder.</p>
      </div>
    </PublicLayout>
  );
}

import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../PlaceholderPage.jsx';

export default function SubmitReportPage() {
  useDocumentTitle('Submit a report');

  return (
    <PublicLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Submit a report</h1>
        <p>Public report submission placeholder.</p>
      </div>
    </PublicLayout>
  );
}

import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function DashboardPage() {
  useDocumentTitle('Dashboard');

  return (
    <StaffLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Dashboard</h1>
        <p>Staff dashboard placeholder.</p>
      </div>
    </StaffLayout>
  );
}

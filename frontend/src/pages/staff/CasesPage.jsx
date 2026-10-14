import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function CasesPage() {
  useDocumentTitle('Cases');

  return (
    <StaffLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Cases</h1>
        <p>Staff cases placeholder.</p>
      </div>
    </StaffLayout>
  );
}

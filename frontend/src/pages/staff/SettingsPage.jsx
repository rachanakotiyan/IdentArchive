import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function SettingsPage() {
  useDocumentTitle('Settings');

  return (
    <StaffLayout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1>Settings</h1>
        <p>Staff settings placeholder.</p>
      </div>
    </StaffLayout>
  );
}

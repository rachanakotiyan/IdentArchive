import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import './ReportPages.css';

export default function ReportConfirmationPage() {
  useDocumentTitle('Report submitted');
  const { referenceNo = '' } = useParams();
  const { user } = useAuth();
  const [copyMessage, setCopyMessage] = useState('');

  const copyReference = async () => {
    setCopyMessage('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(referenceNo);
      setCopyMessage('Reference number copied.');
    } catch {
      setCopyMessage('Clipboard access is unavailable. Select and copy the reference number above.');
    }
  };

  return (
    <PublicLayout>
      <article className="report-confirmation">
        <header className="report-confirmation__header">
          <p className="report-page__eyebrow">Report received</p>
          <h1>Your report has been submitted</h1>
          <p>Keep this reference number to track the report. It will be reviewed by IdentArchive staff.</p>
        </header>

        <section className="report-confirmation__reference" aria-labelledby="confirmation-reference-title">
          <div>
            <p className="report-confirmation__reference-label" id="confirmation-reference-title">Your reference number</p>
            <p className="report-confirmation__reference-number" aria-live="polite">{referenceNo}</p>
          </div>
          <Button type="button" variant="outline" onClick={copyReference}>Copy reference</Button>
        </section>
        {copyMessage && <p className="report-confirmation__copy-status" role="status">{copyMessage}</p>}

        <p className="report-confirmation__copy-status">A copy has been sent to your email (mock).</p>

        <section className="report-confirmation__next">
          <h2>What happens next</h2>
          <p>An officer will review the information. You can use the reference number and the email used on the report to check its status.</p>
          <p>This report is private and will not appear in public case listings unless it is approved.</p>
        </section>

        <div className="report-confirmation__actions">
          <Link to={`/track?referenceNo=${encodeURIComponent(referenceNo)}`} className="btn btn--outline">
            Track this report
          </Link>
          <Link to={user?.role === 'individual' ? '/my-reports' : '/home'} className="btn btn--outline">
            {user?.role === 'individual' ? 'My reports' : 'Return home'}
          </Link>
          <Button type="button" onClick={() => window.print()}>Print acknowledgement</Button>
        </div>
      </article>
    </PublicLayout>
  );
}

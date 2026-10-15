import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as reportService from '../../services/reportService.js';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import './ReportPages.css';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function MyReportsPage() {
  useDocumentTitle('My reports');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      const items = await reportService.listMyReports();
      setReports(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    reportService.listMyReports()
      .then((items) => {
        if (active) setReports(items);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load your reports.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadReports]);

  return (
    <PublicLayout>
      <div className="my-reports">
        <header className="my-reports__header">
          <h1>My reports</h1>
          <p>Reports submitted from {user?.email || 'your account'}.</p>
        </header>
        {loading ? (
          <div role="status" aria-live="polite"><Spinner /> Loading your reports…</div>
        ) : error ? (
          <ErrorState
            title="Could not load reports"
            description="Your reports could not be retrieved right now."
            error={error}
            onRetry={() => {
              setLoading(true);
              setError('');
              loadReports();
            }}
          />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            description="Reports you submit will appear here."
            actionLabel="Start a report"
            onAction={() => navigate('/report/new')}
          />
        ) : (
          <div className="my-reports__list">
            {reports.map((report) => (
              <article className="my-reports__card" key={report.reportId}>
                <div className="my-reports__card-heading">
                  <p className="my-reports__reference">{report.referenceNo}</p>
                  <StatusStamp kind="report" status={report.status} />
                </div>
                <p>{report.reportType === 'found' ? 'Found person report' : 'Missing person report'}</p>
                <p>Submitted {formatDate(report.createdDate)}</p>
                <Link
                  className="my-reports__card-link"
                  to={`/track?referenceNo=${encodeURIComponent(report.referenceNo)}`}
                >
                  Track this report
                </Link>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && (
          <div style={{ marginTop: 'var(--sp-6)' }}>
            <Button as={Link} to="/report/new" variant="outline">Submit a new report</Button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as reportService from '../../services/reportService.js';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import '../report/ReportPages.css';

const NOT_FOUND_MESSAGE = 'No report found for those details.';

function getDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString();
}

export default function TrackReportPage() {
  useDocumentTitle('Track a report');
  const [searchParams] = useSearchParams();
  const [referenceNo, setReferenceNo] = useState(searchParams.get('referenceNo') || '');
  const [pin, setPin] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [touched, setTouched] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    setResult(null);
    setError('');
    setNotFound(false);
    if (!referenceNo.trim() || !pin.trim()) return;

    setLoading(true);
    try {
      const report = await reportService.trackReport(referenceNo.trim(), pin.trim());
      setResult(report);
    } catch (requestError) {
      if (requestError?.status === 404 || requestError?.code === 'NOT_FOUND') {
        setNotFound(true);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to retrieve this report. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="track-page">
        <header className="track-page__header">
          <p className="report-page__eyebrow">Private report lookup</p>
          <h1>Track a report</h1>
          <p>Enter the reference number and tracking PIN from your report confirmation.</p>
        </header>

        <form className="track-page__form" onSubmit={handleSubmit} noValidate>
          <h2>Report details</h2>
          <TextField
            id="track-reference"
            label="Reference number"
            autoComplete="off"
            value={referenceNo}
            onChange={(event) => { setReferenceNo(event.target.value); setResult(null); setNotFound(false); }}
            onBlur={() => setTouched(true)}
            error={touched && !referenceNo.trim() ? 'Enter the reference number.' : ''}
            required
          />
          <TextField
            id="track-pin"
            label="Tracking PIN"
            type="password"
            autoComplete="off"
            value={pin}
            onChange={(event) => { setPin(event.target.value); setResult(null); setNotFound(false); }}
            onBlur={() => setTouched(true)}
            error={touched && !pin.trim() ? 'Enter the tracking PIN.' : ''}
            required
          />
          {error && <p className="auth-form__error" role="alert">{error}</p>}
          <Button type="submit" loading={loading}>{loading ? 'Checking…' : 'Check report status'}</Button>
        </form>

        {notFound && <p className="auth-form__error" role="status">{NOT_FOUND_MESSAGE}</p>}

        {result && (
          <section className="track-result" aria-labelledby="track-result-title">
            <h2 id="track-result-title">Report status</h2>
            <p className="track-result__reference">{result.referenceNo}</p>
            <StatusStamp kind="report" status={result.status} />
            {result.infoMessage && <p className="track-result__info">{result.infoMessage}</p>}
            <ol className="track-timeline" aria-label="Report status timeline">
              {result.timeline.map((item, index) => (
                <li className="track-timeline__item" key={`${item.statusLabel}-${item.date}-${index}`}>
                  <strong>{item.statusLabel}</strong>
                  <time dateTime={item.date}>{getDate(item.date)}</time>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}

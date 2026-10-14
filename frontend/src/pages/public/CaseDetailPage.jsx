import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, Phone } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCase } from '../../services/publicService.js';
import CaseIcon from '../../components/ui/CaseIcon.jsx';
import Card from '../../components/ui/Card.jsx';
import FileTabHeading from '../../components/ui/FileTabHeading.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import './CaseDetailPage.css';

function formatDate(value) {
  if (!value) return 'Date not provided';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
}

function CaseDetailSkeleton() {
  return (
    <div className="case-detail__skeleton" aria-label="Loading case details">
      <Skeleton width="44%" height="14px" />
      <Skeleton width="72%" height="34px" style={{ marginTop: '18px' }} />
      <Skeleton width="32%" height="18px" style={{ marginTop: '12px' }} />
      <Skeleton width="100%" height="130px" style={{ marginTop: '28px' }} />
      <Skeleton width="100%" height="180px" style={{ marginTop: '16px' }} />
    </div>
  );
}

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([caseId, retry]);
  const [result, setResult] = useState({ key: null, caseItem: null, error: null, notFound: false });
  const loading = result.key !== requestKey;
  const caseItem = loading ? null : result.caseItem;
  const error = loading ? null : result.error;
  const notFound = !loading && result.notFound;

  useEffect(() => {
    let active = true;
    document.title = 'Case details | IdentArchive';
    getCase(caseId)
      .then((result) => {
        if (!active) return;
        setResult({ key: requestKey, caseItem: result, error: null, notFound: false });
        document.title = `${result.personName || result.title} | IdentArchive`;
      })
      .catch((caughtError) => {
        if (!active) return;
        if (caughtError instanceof Error && caughtError.message === 'Case not found.') {
          setResult({ key: requestKey, caseItem: null, error: null, notFound: true });
          document.title = 'Case not found | IdentArchive';
        } else {
          setResult({
            key: requestKey,
            caseItem: null,
            error: caughtError instanceof Error ? caughtError.message : 'Unable to load this case.',
            notFound: false,
          });
          document.title = 'Case details | IdentArchive';
        }
      });
    return () => { active = false; };
  }, [caseId, requestKey]);

  if (loading) {
    return <main className="case-detail"><CaseDetailSkeleton /></main>;
  }

  if (notFound) {
    return (
      <main className="case-detail">
        <EmptyState
          title="This public case could not be found"
          description="It may have been removed or the case number may be incorrect."
          actionLabel="Browse public cases"
          onAction={() => navigate('/cases')}
        />
        <Link className="case-detail__back-link" to="/cases"><ArrowLeft size={16} /> Back to cases</Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="case-detail">
        <ErrorState
          title="Case details could not be loaded"
          description="Please try again. If the problem continues, return to the public case list."
          error={error}
          onRetry={() => setRetry((value) => value + 1)}
        />
        <Link className="case-detail__back-link" to="/cases"><ArrowLeft size={16} /> Back to cases</Link>
      </main>
    );
  }

  const age = caseItem.age != null
    ? `${caseItem.age} years`
    : caseItem.estimatedAge
      ? `Estimated ${caseItem.estimatedAge} years`
      : null;
  const place = [caseItem.city, caseItem.district, caseItem.state].filter(Boolean).join(', ');
  const placeLabel = caseItem.kind === 'found' ? 'Found place' : 'Last seen';
  const updates = [...(caseItem.updates ?? [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <main className="case-detail">
      <Link className="case-detail__back-link" to="/cases"><ArrowLeft size={16} /> Back to cases</Link>

      <header className="case-detail__header">
        <div className="case-detail__icon"><CaseIcon crimeType={caseItem.crimeType} size="lg" /></div>
        <div className="case-detail__heading">
          <FileTabHeading active as="h1">{caseItem.kind === 'found' ? 'Found person record' : 'Missing person record'}</FileTabHeading>
          <p className="case-detail__number">{caseItem.caseNumber}</p>
          <h2 className="case-detail__title">{caseItem.personName || caseItem.title || 'Unidentified person'}</h2>
          <StatusStamp kind="case" status={caseItem.caseStatus} />
        </div>
      </header>

      <div className="case-detail__sections">
        <section aria-labelledby="case-facts-heading">
          <FileTabHeading active as="h2" id="case-facts-heading">Key facts</FileTabHeading>
          <Card className="case-detail__panel">
            <dl className="case-detail__facts">
              {age && <div><dt>Age</dt><dd>{age}</dd></div>}
              {caseItem.gender && <div><dt>Gender</dt><dd>{caseItem.gender}</dd></div>}
              <div><dt>Record type</dt><dd>{caseItem.kind === 'found' ? 'Found person' : 'Missing person'}</dd></div>
              {caseItem.crimeType && <div><dt>Case category</dt><dd>{caseItem.crimeType.replaceAll('_', ' ')}</dd></div>}
              <div>
                <dt>{caseItem.kind === 'found' ? 'Date found' : 'Date last seen'}</dt>
                <dd><CalendarDays size={15} aria-hidden="true" />{formatDate(caseItem.date)}</dd>
              </div>
              {place && <div><dt>{placeLabel}</dt><dd><MapPin size={15} aria-hidden="true" />{place}</dd></div>}
            </dl>
          </Card>
        </section>

        <section aria-labelledby="case-description-heading">
          <FileTabHeading active as="h2" id="case-description-heading">Public description</FileTabHeading>
          <Card className="case-detail__panel">
            <p className="case-detail__prose">{caseItem.description || caseItem.shortDescription || 'No public description is available.'}</p>
          </Card>
        </section>

        {(caseItem.physicalFeatures || caseItem.heightCm != null || caseItem.identifyingMarks) && (
          <section aria-labelledby="case-features-heading">
            <FileTabHeading active as="h2" id="case-features-heading">Physical features and identifying marks</FileTabHeading>
            <Card className="case-detail__panel case-detail__features">
              {caseItem.physicalFeatures && (
                <div>
                  <h3>Physical features</h3>
                  <p>{caseItem.physicalFeatures}</p>
                </div>
              )}
              {caseItem.heightCm != null && (
                <div>
                  <h3>Height</h3>
                  <p>{caseItem.heightCm} cm</p>
                </div>
              )}
              {caseItem.identifyingMarks && (
                <div>
                  <h3>Identifying marks</h3>
                  <p>{caseItem.identifyingMarks}</p>
                </div>
              )}
            </Card>
          </section>
        )}

        <section aria-labelledby="case-timeline-heading">
          <FileTabHeading active as="h2" id="case-timeline-heading">Public updates</FileTabHeading>
          <Card className="case-detail__panel">
            {updates.length > 0 ? (
              <ol className="case-detail__timeline">
                {updates.map((update, index) => (
                  <li key={`${update.date || 'update'}-${index}`}>
                    <time dateTime={update.date || undefined}>{formatDate(update.date)}</time>
                    <p>{update.note || 'A public case update was recorded.'}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="case-detail__quiet">No public updates have been posted.</p>
            )}
          </Card>
        </section>

        <Card className="case-detail__helpline" raised>
          <div className="case-detail__helpline-icon"><Phone size={20} aria-hidden="true" /></div>
          <div>
            <h2>Have information?</h2>
            <p>Contact the helpline and share the case number with the operator. Do not approach anyone or publish sensitive details online.</p>
            <a href="tel:112" className="case-detail__helpline-number">Call 112</a>
            <span className="case-detail__helpline-note">Emergency numbers should be verified before deployment.</span>
          </div>
        </Card>
      </div>
    </main>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronDown, Search } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import { getPublicStats } from '../../services/publicService.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import './HomePage.css';

/* ── Static content ─────────────────────────────────────── */
const HOW_IT_WORKS = [
  {
    title: 'Create an account',
    desc: 'Register with your name and email. Your contact details are used only for case correspondence and are never made public.',
  },
  {
    title: 'Submit a report',
    desc: 'Fill in the details of the missing or found person, including physical description and last known location. A reference number is issued immediately.',
  },
  {
    title: 'Officer review',
    desc: 'A trained officer reviews your submission. If more information is needed, you will be contacted via email.',
  },
  {
    title: 'Track progress',
    desc: 'Use your reference number and email at /track to check the current status of your report at any time.',
  },
];

const SAFETY_TIPS = [
  {
    title: 'Act immediately',
    body: 'There is no mandatory waiting period to report a missing person. Contact local police and submit a report here as soon as you are concerned.',
  },
  {
    title: 'Keep a record',
    body: 'Note the reference number from this system and the FIR number from the police. Keep contact numbers for the investigating officer.',
  },
  {
    title: 'Inform trusted contacts',
    body: 'Inform close family, neighbours, and the person\'s workplace or school. Ask them to contact you if they hear anything.',
  },
  {
    title: 'Do not share on social media without guidance',
    body: 'Premature or incorrect public posts can complicate investigations. Coordinate with the investigating officer before posting publicly.',
  },
  {
    title: 'Watch for scams',
    body: 'Fraudsters sometimes contact families claiming to have information in exchange for money. Report such contacts to police immediately.',
  },
  {
    title: 'Look after yourself',
    body: 'This is an extremely stressful situation. Seek support from the helplines below. Your wellbeing matters and helps you support the investigation.',
  },
];

const RESOLVED_STORIES = [
  {
    caseNumber: 'IA-2026-0005',
    title: 'Elderly resident located safely',
    desc: 'A 74-year-old woman reported missing from Central Delhi was located at New Delhi Railway Station within 24 hours, following a coordinated alert through this system.',
    city: 'New Delhi',
    crimeType: 'missing_person',
  },
  {
    caseNumber: 'IA-2026-0011',
    title: 'Woman reached safety through shelter network',
    desc: 'A 28-year-old woman reported missing from Bengaluru was located at a partner shelter home. The case was resolved within 72 hours.',
    city: 'Bengaluru',
    crimeType: 'domestic_violence',
  },
  {
    caseNumber: 'IA-2026-0012',
    title: 'Teenager found with relatives',
    desc: 'A 17-year-old reported missing from South Delhi was located staying with relatives in Jaipur. Family reunification was confirmed.',
    city: 'New Delhi',
    crimeType: 'runaway',
  },
];

const EMERGENCY_CONTACTS = [
  { number: '112', service: 'National Emergency Helpline', notes: 'Police, ambulance, fire — 24/7' },
  { number: '1098', service: 'Childline', notes: 'For children in distress — 24/7' },
  { number: '181', service: 'Women Helpline', notes: 'Distress and violence support — 24/7' },
  { number: '1930', service: 'Cybercrime Helpline', notes: 'Report online crimes' },
  { number: '100', service: 'Police', notes: 'Direct to local police control room' },
];

const FAQ_ITEMS = [
  {
    q: 'How long does it take for a report to be reviewed?',
    a: 'Officers aim to review new submissions within 24–48 hours. Urgent cases (involving children or suspected abduction) are prioritised and reviewed as quickly as possible.',
  },
  {
    q: 'Do I need a police FIR to use IdentArchive?',
    a: 'No. You can submit a report here independently. However, we strongly recommend also filing a First Information Report (FIR) at your nearest police station, as the two records support each other.',
  },
  {
    q: 'Can I report a found person who is unable to identify themselves?',
    a: 'Yes. Select "Found person" when starting your report. You do not need to know the person\'s name or any details — describe what you can observe and where you found them.',
  },
  {
    q: 'What happens to my personal information?',
    a: 'Your contact details (name, email, phone) are visible only to assigned officers and administrators. They are never displayed on public pages and are used solely for case correspondence.',
  },
  {
    q: 'Will I be notified when the status of my report changes?',
    a: 'Officers leave notes when requesting more information or approving a report. You can check the status at any time using the Track Report page — no account login is needed if you have your reference number and registered email.',
  },
  {
    q: 'What if I have information about a case but am not the reporter?',
    a: 'Call the national emergency helpline on 112, or contact the relevant state police directly. Do not attempt to intervene in potential abduction or trafficking situations yourself.',
  },
];

/* ── Stat item ───────────────────────────────────────────── */
function StatItem({ value, label, loading }) {
  return (
    <div className="home-stats__item">
      {loading
        ? <div className="home-stats__skeleton" aria-hidden="true" />
        : <div className="home-stats__value">{value ?? '—'}</div>
      }
      <div className="home-stats__label">{label}</div>
    </div>
  );
}

/* ── FAQ accordion item ──────────────────────────────────── */
function FaqItem({ q, a, id }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="home-faq__item">
      <button
        type="button"
        id={`faq-trigger-${id}`}
        className="home-faq__trigger"
        aria-expanded={open}
        aria-controls={`faq-panel-${id}`}
        onClick={() => setOpen(v => !v)}
      >
        {q}
        <ChevronDown size={18} className="home-faq__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`faq-panel-${id}`}
          role="region"
          aria-labelledby={`faq-trigger-${id}`}
          className="home-faq__panel"
        >
          {a}
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function HomePage() {
  useDocumentTitle('Home');
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [stats, setStats]       = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError]     = useState(null);

  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPublicStats()
      .then(data => { if (!cancelled) { setStats(data); setStatsLoading(false); } })
      .catch(err  => { if (!cancelled) { setStatsError(err.message); setStatsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/cases?q=${encodeURIComponent(q)}` : '/cases');
  };

  const retryStats = () => {
    setStatsLoading(true);
    setStatsError(null);
    getPublicStats()
      .then(data => { setStats(data); setStatsLoading(false); })
      .catch(err  => { setStatsError(err.message); setStatsLoading(false); });
  };

  return (
    <PublicLayout>
      {/* Hero ─────────────────────────────────────────────── */}
      <div className="home-hero" style={{ margin: 'calc(-1 * var(--sp-6)) calc(-1 * var(--sp-4)) 0' }}>
        <div className="home-hero__inner">
          <h1 className="home-hero__headline">
            A clearer way to<br />
            <span>report and track cases.</span>
          </h1>
          <p className="home-hero__sub">
            IdentArchive helps families, found-person reporters, and officers record,
            match and resolve missing and unidentified person cases — carefully and privately.
          </p>

          <div className="home-search">
            <form
              className="home-search__form"
              role="search"
              onSubmit={handleSearch}
              aria-label="Search cases"
            >
              <label htmlFor="home-search-input" className="home-search__label">
                Search by name, case number or place
              </label>
              <input
                id="home-search-input"
                ref={searchRef}
                type="search"
                className="home-search__input"
                placeholder="Name, case number or place…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="home-search__btn" aria-label="Search">
                <Search size={18} aria-hidden="true" />
                Search
              </button>
            </form>
          </div>

          <div className="home-hero__ctas">
            <Button as={Link} to="/report/new" variant="solid" size="lg">
              Report a missing person
            </Button>
            <Button as={Link} to="/cases" variant="outline" size="lg">
              Search active cases
            </Button>
          </div>
        </div>
      </div>

      {/* Stats strip ──────────────────────────────────────── */}
      <div
        className="home-stats"
        style={{ margin: '0 calc(-1 * var(--sp-4))' }}
        aria-label="Live statistics"
      >
        <div className="home-stats__inner">
          {statsError ? (
            <ErrorState
              description="Could not load statistics."
              error={statsError}
              onRetry={retryStats}
              style={{ padding: 'var(--sp-4)' }}
            />
          ) : (
            <>
              <StatItem value={stats?.activeCases}    label="Active cases"     loading={statsLoading} />
              <div className="home-stats__divider" aria-hidden="true" />
              <StatItem value={stats?.underReview}    label="Under review"     loading={statsLoading} />
              <div className="home-stats__divider" aria-hidden="true" />
              <StatItem value={stats?.resolvedCases}  label="Resolved cases"   loading={statsLoading} />
              <div className="home-stats__divider" aria-hidden="true" />
              <StatItem value={stats?.reportsThisWeek} label="Reports this week" loading={statsLoading} />
            </>
          )}
        </div>
      </div>

      {/* Main content sections ────────────────────────────── */}
      <div className="home-content">

        {/* How it works ─────────────────────────────────── */}
        <section aria-labelledby="how-it-works-heading">
          <p className="home-section__eyebrow" aria-hidden="true">How it works</p>
          <h2 id="how-it-works-heading" className="home-section__title">
            From report to resolution
          </h2>
          <p className="home-section__body">
            Every report submitted goes through a structured review process by
            trained officers. Here is what to expect.
          </p>
          <div className="home-steps">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="home-step">
                <div className="home-step__num" aria-hidden="true">{i + 1}</div>
                <h3 className="home-step__title">{step.title}</h3>
                <p className="home-step__desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Safety tips ───────────────────────────────────── */}
        <section aria-labelledby="safety-tips-heading">
          <p className="home-section__eyebrow" aria-hidden="true">Safety guidance</p>
          <h2 id="safety-tips-heading" className="home-section__title">
            What to do right now
          </h2>
          <p className="home-section__body">
            If someone is missing, the first hours are critical.
            These steps can help you act effectively while supporting the investigation.
          </p>
          <div className="home-safety-tips">
            {SAFETY_TIPS.map((tip, i) => (
              <div key={i} className="home-safety-tip">
                <p className="home-safety-tip__title">{tip.title}</p>
                <p className="home-safety-tip__body">{tip.body}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
            For full guidance, visit the{' '}
            <Link to="/safety">Safety &amp; FAQ page</Link>.
          </p>
        </section>

        {/* Resolved stories ──────────────────────────────── */}
        <section aria-labelledby="resolved-heading">
          <p className="home-section__eyebrow" aria-hidden="true">Resolved cases</p>
          <h2 id="resolved-heading" className="home-section__title">
            Cases that have been resolved
          </h2>
          <p className="home-section__body">
            The following cases were resolved through coordinated reporting and
            officer review. Names and identifying details are summarised for privacy.
          </p>
          <div className="home-stories">
            {RESOLVED_STORIES.map((story, i) => (
              <div key={i} className="home-story">
                <div className="home-story__header">
                  <div className="home-story__icon">
                    <CheckCircle size={20} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <div className="home-story__meta">
                    <span className="home-story__case-num">{story.caseNumber}</span>
                    <span className="home-story__title">{story.title}</span>
                  </div>
                </div>
                <p className="home-story__desc">{story.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency contacts ────────────────────────────── */}
        <section aria-labelledby="emergency-heading">
          <p className="home-section__eyebrow" aria-hidden="true">Emergency contacts</p>
          <h2 id="emergency-heading" className="home-section__title">
            Helplines and emergency numbers
          </h2>
          <p className="home-section__body">
            These numbers are available 24 hours a day.
            In immediate danger, call <strong>112</strong> first.
          </p>
          <div className="home-emergency">
            <table className="home-emergency__table" aria-label="Emergency helpline numbers">
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Service</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {EMERGENCY_CONTACTS.map((c) => (
                  <tr key={c.number}>
                    <td>
                      <span className="home-emergency__number">{c.number}</span>
                    </td>
                    <td>{c.service}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="home-emergency__note">
              Note: Emergency numbers should be verified before use. These numbers are correct as of 2026
              but may change. Confirm at your state police or government website.
            </p>
          </div>
        </section>

        {/* FAQ ───────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading">
          <p className="home-section__eyebrow" aria-hidden="true">FAQ</p>
          <h2 id="faq-heading" className="home-section__title">
            Frequently asked questions
          </h2>
          <div className="home-faq" role="list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} role="listitem">
                <FaqItem q={item.q} a={item.a} id={i} />
              </div>
            ))}
          </div>
        </section>

      </div>
    </PublicLayout>
  );
}

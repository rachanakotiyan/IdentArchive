import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const FAQ_ITEMS = [
  {
    question: 'Is IdentArchive connected to a live police or government system?',
    answer: 'No. This is a frontend demonstration with mock accounts and sample records. Reports submitted here do not reach law enforcement. Call 112 or contact your local police for real assistance.',
  },
  {
    question: 'How do I submit a missing- or found-person report in the demo?',
    answer: 'Sign in with the public demo account and open Report. The form guides you through the required steps and displays a confirmation reference when submitted.',
  },
  {
    question: 'How can I check the status of a demo report?',
    answer: 'Open Track Report and enter the reference number and reporter email used for the sample report. Signed-in public users can also review their reports from My Reports.',
  },
  {
    question: 'Who can see personal details entered in a report?',
    answer: 'The demo separates public case information from reporter details in its interface. Do not enter real personal information: this prototype has no production security or data-handling guarantees.',
  },
  {
    question: 'What should I do if someone is missing or in immediate danger?',
    answer: 'Contact the police immediately; call 112 in an emergency. There is no need to wait before reporting a missing person. The demo is not an emergency reporting channel.',
  },
];

export default function FaqPage() {
  useDocumentTitle('FAQ');

  return (
    <PublicLayout>
      <section aria-labelledby="faq-page-title" style={{ display: 'grid', gap: 'var(--sp-5)', maxWidth: '72ch', margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)' }}>
        <header>
          <p style={{ color: 'var(--accent)', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Help
          </p>
          <h1 id="faq-page-title">Frequently asked questions</h1>
          <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)' }}>
            Answers about using this demonstration and where to get real-world help.
          </p>
        </header>
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          {FAQ_ITEMS.map(({ question, answer }) => (
            <details
              key={question}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--sp-4)',
              }}
            >
              <summary style={{ color: 'var(--ink)', cursor: 'pointer', fontWeight: 600 }}>
                {question}
              </summary>
              <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)', margin: 'var(--sp-3) 0 0' }}>
                {answer}
              </p>
            </details>
          ))}
        </div>
        <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)' }}>
          For more safety guidance and contact numbers, visit <Link to="/safety">Safety &amp; guidance</Link>.
        </p>
      </section>
    </PublicLayout>
  );
}

import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const FAQ_ITEMS = [
  {
    question: 'Is IdentArchive connected to an emergency dispatch system?',
    answer: 'No. Reports submitted here are processed by investigating officers. For immediate life-safety emergencies, please call 112 or your local police station directly.',
  },
  {
    question: 'How do I submit a missing- or found-person report?',
    answer: 'Sign in to your account and select Submit Report. The form guides you through the required steps and provides an official reference number upon submission.',
  },
  {
    question: 'How can I check the status of a submitted report?',
    answer: 'Open Track Report and enter your reference number and registered email address. Signed-in users can also monitor all their submissions under My Reports.',
  },
  {
    question: 'Who can see personal details entered in a report?',
    answer: 'Public case views strictly omit reporter contact details and internal review notes. Only authorized investigating officers and administrators have access to sensitive records.',
  },
  {
    question: 'What should I do if someone is missing or in immediate danger?',
    answer: 'Contact the police immediately; call 112 in an emergency. There is no need to wait before reporting a missing person.',
  },
];

export default function FaqPage() {
  useDocumentTitle('Frequently Asked Questions');
  return (
    <PublicLayout>
      <div
        style={{
          maxWidth: 'var(--container-md)',
          margin: '0 auto',
          padding: 'var(--sp-8) var(--sp-4)',
        }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--sp-2)' }}>
          Frequently Asked Questions
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: 'var(--sp-8)' }}>
          Common questions about filing reports, tracking status, and public case listings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          {FAQ_ITEMS.map((item, index) => (
            <section
              key={index}
              style={{
                borderBottom: '1px solid var(--line)',
                paddingBottom: 'var(--sp-6)',
              }}
            >
              <h2
                style={{
                  fontSize: 'var(--text-lg)',
                  color: 'var(--ink)',
                  marginBottom: 'var(--sp-2)',
                }}
              >
                {item.question}
              </h2>
              <p
                style={{
                  color: 'var(--muted)',
                  lineHeight: 'var(--leading-loose)',
                }}
              >
                {item.answer}
              </p>
            </section>
          ))}
        </div>

        <div style={{ marginTop: 'var(--sp-8)' }}>
          <p style={{ color: 'var(--muted)' }}>
            Need emergency support or crisis counseling? Review our{' '}
            <Link to="/safety">Safety and Helplines directory</Link>.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

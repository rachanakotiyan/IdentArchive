import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function AboutPage() {
  useDocumentTitle('About');

  return (
    <PublicLayout>
      <article style={{ display: 'grid', gap: '1rem', maxWidth: '72ch', margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)' }}>
        <p style={{ color: 'var(--accent)', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          About IdentArchive
        </p>
        <h1>Helping people find the information that matters</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)' }}>
          IdentArchive is a demonstration of a public missing- and found-person
          reporting workflow. It brings report submission, case status tracking,
          public case listings, and staff review into one interface.
        </p>
        <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)' }}>
          This frontend uses mock accounts and sample records. It is not connected
          to law enforcement or a production service, and it must not be used to
          submit real personal information or report an emergency.
        </p>
        <p style={{ lineHeight: 'var(--leading-loose)' }}>
          For urgent help, call <strong>112</strong>. Learn how the demo works in the{' '}
          <Link to="/faq">frequently asked questions</Link>, or review the{' '}
          <Link to="/safety">safety guidance and helplines</Link>.
        </p>
      </article>
    </PublicLayout>
  );
}

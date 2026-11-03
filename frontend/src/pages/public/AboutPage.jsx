import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function AboutPage() {
  useDocumentTitle('About IdentArchive');
  return (
    <PublicLayout>
      <article
        style={{
          maxWidth: 'var(--container-md)',
          margin: '0 auto',
          padding: 'var(--sp-8) var(--sp-4)',
        }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--sp-4)' }}>
          About IdentArchive
        </h1>
        <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)' }}>
          IdentArchive is a centralized case management platform for missing and
          unidentified person records. It brings report submission, case status tracking,
          public case listings, and staff review into one secure interface.
        </p>
        <p style={{ color: 'var(--muted)', lineHeight: 'var(--leading-loose)' }}>
          This portal provides public reporting, case status tracking, and
          investigative coordination. Emergency reports must always be directed
          to local law enforcement immediately.
        </p>
        <p style={{ lineHeight: 'var(--leading-loose)' }}>
          For urgent help, call <strong>112</strong>. Learn how the system works in the{' '}
          <Link to="/faq">frequently asked questions</Link>, or review the{' '}
          <Link to="/safety">safety guidance and helplines</Link>.
        </p>
      </article>
    </PublicLayout>
  );
}

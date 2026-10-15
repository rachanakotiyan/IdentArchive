import Logo from '../ui/Logo.jsx';
import './AuthShell.css';

export default function AuthShell({ title, description, children }) {
  return (
    <main className="auth-shell">
      <div className="auth-shell__brand">
        <Logo size={36} />
        <span className="auth-shell__mode">Demo mode</span>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-card__header">
          <h1 id="auth-title">{title}</h1>
          {description && <p>{description}</p>}
        </header>
        {children}
      </section>
    </main>
  );
}

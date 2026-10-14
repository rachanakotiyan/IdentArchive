import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/useAuth.js';
import { useTheme } from '../../context/useTheme.js';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import './WelcomePage.css';

const POINTS = [
  {
    title: 'Submit a report',
    body: 'Register for a free account and submit a missing or found person report in minutes. Every detail is recorded and tracked.',
  },
  {
    title: 'Matching and review',
    body: 'Trained officers review every submission. Our system compares missing and found records to surface potential matches.',
  },
  {
    title: 'Track your case',
    body: 'Use your reference number and email at any time to check the status of your report — no phone calls required.',
  },
];

export default function WelcomePage() {
  const { user } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();

  useEffect(() => {
    document.title = 'IdentArchive — Every detail on record.';
  }, []);

  // Logged-in users skip the welcome screen
  if (user) return <Navigate to="/home" replace />;

  return (
    <div className="welcome-page">
      {/* Demo mode notice */}
      <div className="welcome-page__demo-bar" role="status">
        DEMO MODE — This is a mock system. No data submitted here is real.
      </div>

      {/* Theme toggle (floating) */}
      <button
        type="button"
        className="welcome-page__theme-toggle"
        aria-label="Toggle colour theme"
        onClick={toggleTheme}
      >
        {effectiveTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="welcome-page__card">
        {/* Logo + tagline */}
        <div className="welcome-page__logo-wrap">
          <Logo size={56} showWordmark as="span" />
          <p className="welcome-page__tagline">Every detail on record.</p>
        </div>

        {/* Three-point introduction */}
        <div className="welcome-page__intro">
          <div className="welcome-page__points">
            {POINTS.map((pt, i) => (
              <div key={i} className="welcome-page__point">
                <div className="welcome-page__point-num" aria-hidden="true">
                  {i + 1}
                </div>
                <div className="welcome-page__point-text">
                  <strong>{pt.title}</strong>
                  {pt.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="welcome-page__actions">
          <Button as={Link} to="/home" variant="solid" size="lg" style={{ width: '100%' }}>
            Enter IdentArchive
          </Button>
          <div className="welcome-page__actions-row">
            <Button as={Link} to="/login" variant="outline">
              Log in
            </Button>
            <Button as={Link} to="/register" variant="outline">
              Register
            </Button>
          </div>
        </div>

        <p className="welcome-page__notice">
          Emergency? Call <strong>112</strong> immediately.
          This system does not replace emergency services.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthPasswordField from '../../components/auth/AuthPasswordField.jsx';
import AuthShell from '../../components/auth/AuthShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { useAuth } from '../../context/useAuth.js';
import { DEMO_ACCOUNTS } from '../../mock/users.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unable to log in. Please try again.';
}

export default function LoginPage() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fillDemoAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login({ email: email.trim(), password });
      const from = location.state?.from;
      if (from?.pathname) {
        navigate(`${from.pathname}${from.search || ''}${from.hash || ''}`, { replace: true });
      } else {
        navigate(user.role === 'individual' ? '/home' : '/staff', { replace: true });
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Log in" description="Use your IdentArchive account to continue.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <TextField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <AuthPasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="auth-form__links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create an account</Link>
        </div>
        <Button type="submit" className="auth-form__submit" loading={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <section className="demo-accounts" aria-labelledby="demo-accounts-title">
        <div className="demo-accounts__header">
          <h2 id="demo-accounts-title">Demo accounts</h2>
          <p>Mock data only, not real credentials.</p>
        </div>
        <div className="demo-accounts__list">
          {DEMO_ACCOUNTS.map((account) => (
            <div className="demo-accounts__item" key={account.email}>
              <div className="demo-accounts__identity">
                <strong>{account.label}</strong>
                <span>{account.email}</span>
                <span className="demo-accounts__credential">Password: {account.password}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => fillDemoAccount(account)}
              >
                Use this account
              </Button>
            </div>
          ))}
        </div>
      </section>
    </AuthShell>
  );
}

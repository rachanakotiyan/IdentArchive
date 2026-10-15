import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../../components/auth/AuthShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/authService.js';

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSent(false);
    try {
      await authService.requestPasswordReset({ email: email.trim() });
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to request a reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot password" description="Enter the email address associated with your account.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        {sent && (
          <p className="auth-form__success" role="status">
            If that email exists, we have sent a link.
          </p>
        )}
        <TextField
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button type="submit" className="auth-form__submit" loading={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <div className="auth-form__footer">
        <Link to="/login">Back to log in</Link>
        <Link to="/reset-password">Enter a reset token</Link>
      </div>
    </AuthShell>
  );
}

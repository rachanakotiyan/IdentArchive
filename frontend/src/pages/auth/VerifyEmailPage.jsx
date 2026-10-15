import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../../components/auth/AuthShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/authService.js';

export default function VerifyEmailPage() {
  useDocumentTitle('Verify email');
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const email = searchParams.get('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setVerified(false);
    setLoading(true);
    try {
      await authService.verifyEmail({ token: token.trim() });
      setVerified(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to verify your email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      description={email ? `Enter the verification token for ${email}.` : 'Enter the verification token sent to your email.'}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        {verified && (
          <p className="auth-form__success" role="status">
            Your email has been verified. You can now log in.
          </p>
        )}
        <TextField
          id="verification-token"
          label="Verification token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
        />
        <Button type="submit" className="auth-form__submit" loading={loading}>
          {loading ? 'Verifying…' : 'Verify email'}
        </Button>
      </form>
      <div className="auth-form__footer">
        <Link to="/login">Back to log in</Link>
      </div>
    </AuthShell>
  );
}

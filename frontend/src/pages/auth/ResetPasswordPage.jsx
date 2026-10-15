import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthPasswordField from '../../components/auth/AuthPasswordField.jsx';
import AuthShell from '../../components/auth/AuthShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/authService.js';

export default function ResetPasswordPage() {
  useDocumentTitle('Reset password');
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token: token.trim(), newPassword: password });
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password" description="Enter the reset token and choose a new password.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        {success && (
          <p className="auth-form__success" role="status">
            Your password has been reset. You can now log in.
          </p>
        )}
        <TextField
          id="reset-token"
          label="Reset token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
        />
        <AuthPasswordField
          id="reset-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AuthPasswordField
          id="reset-confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" className="auth-form__submit" loading={loading}>
          {loading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
      <div className="auth-form__footer">
        <Link to="/login">Back to log in</Link>
      </div>
    </AuthShell>
  );
}

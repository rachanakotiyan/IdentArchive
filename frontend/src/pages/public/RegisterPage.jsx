import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthPasswordField from '../../components/auth/AuthPasswordField.jsx';
import AuthShell from '../../components/auth/AuthShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const initialValues = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

function validate(values) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const digits = values.phone.replace(/\D/g, '');

  if (!values.name.trim()) errors.name = 'Enter your name.';
  if (!emailPattern.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (digits.length < 8 || digits.length > 15) errors.phone = 'Enter a phone number with 8 to 15 digits.';
  if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

function getPasswordStrength(password) {
  if (!password) return 'Not set';
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return 'Weak';
  if (score <= 3) return 'Fair';
  return 'Strong';
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unable to create your account. Please try again.';
}

export default function RegisterPage() {
  useDocumentTitle('Register');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errors = validate(values);

  const updateField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setError('');
  };

  const fieldError = (field) => (touched[field] || submitted ? errors[field] : '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError('');
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
      });
      navigate(`/verify-email?email=${encodeURIComponent(values.email.trim())}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create an account" description="Register to submit and follow reports.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <TextField
          id="register-name"
          label="Name"
          autoComplete="name"
          value={values.name}
          onChange={updateField('name')}
          error={fieldError('name')}
          required
        />
        <TextField
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={updateField('email')}
          error={fieldError('email')}
          required
        />
        <TextField
          id="register-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={updateField('phone')}
          error={fieldError('phone')}
          required
        />
        <AuthPasswordField
          id="register-password"
          label="Password"
          autoComplete="new-password"
          value={values.password}
          onChange={updateField('password')}
          hint={`Password strength: ${getPasswordStrength(values.password)}. Use at least 8 characters.`}
          error={fieldError('password')}
        />
        <AuthPasswordField
          id="register-confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={updateField('confirmPassword')}
          error={fieldError('confirmPassword')}
        />
        <Button type="submit" className="auth-form__submit" loading={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <div className="auth-form__footer">
        <span>Already have an account?</span>
        <Link to="/login">Log in</Link>
      </div>
    </AuthShell>
  );
}

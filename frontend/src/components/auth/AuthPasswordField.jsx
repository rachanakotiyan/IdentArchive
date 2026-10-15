import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  required = true,
}) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(' ') || undefined;
  const [shown, setShown] = useState(false);

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__required" aria-hidden="true">*</span>}
      </label>
      <div className="auth-password-field">
        <input
          id={id}
          className={`field__control${error ? ' field__control--error' : ''}`}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="auth-password-field__toggle"
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field__error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

import './Field.css';

let _id = 0;
const genId = (prefix) => `${prefix}-${++_id}`;

/**
 * Shared field layout wrapper (used by TextField, TextArea, SelectField, DateField)
 */
function FieldWrapper({ id, label, hint, error, required, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="field__required" aria-hidden="true">*</span>}
        </label>
      )}
      {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
      {children}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

function buildDescribedBy(id, { hint, error }) {
  const parts = [];
  if (hint)  parts.push(`${id}-hint`);
  if (error) parts.push(`${id}-error`);
  return parts.length ? parts.join(' ') : undefined;
}

/**
 * TextField
 */
export function TextField({
  id: propId,
  label,
  hint,
  error,
  required,
  className = '',
  type = 'text',
  ...rest
}) {
  const id = propId ?? genId('tf');
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        type={type}
        className={`field__control${error ? ' field__control--error' : ''} ${className}`}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={buildDescribedBy(id, { hint, error })}
        {...rest}
      />
    </FieldWrapper>
  );
}

/**
 * TextArea
 */
export function TextArea({
  id: propId,
  label,
  hint,
  error,
  required,
  rows = 4,
  className = '',
  ...rest
}) {
  const id = propId ?? genId('ta');
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        rows={rows}
        className={`field__control${error ? ' field__control--error' : ''} ${className}`}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={buildDescribedBy(id, { hint, error })}
        {...rest}
      />
    </FieldWrapper>
  );
}

/**
 * SelectField
 */
export function SelectField({
  id: propId,
  label,
  hint,
  error,
  required,
  children,
  className = '',
  ...rest
}) {
  const id = propId ?? genId('sf');
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required}>
      <select
        id={id}
        className={`field__control${error ? ' field__control--error' : ''} ${className}`}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={buildDescribedBy(id, { hint, error })}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

/**
 * DateField
 */
export function DateField({
  id: propId,
  label,
  hint,
  error,
  required,
  className = '',
  ...rest
}) {
  const id = propId ?? genId('df');
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        type="date"
        className={`field__control${error ? ' field__control--error' : ''} ${className}`}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={buildDescribedBy(id, { hint, error })}
        {...rest}
      />
    </FieldWrapper>
  );
}

/**
 * Checkbox
 */
export function Checkbox({
  id: propId,
  label,
  hint,
  error,
  className = '',
  ...rest
}) {
  const id = propId ?? genId('cb');
  return (
    <div className={`field-check ${className}`}>
      <div className="field-check__item">
        <input
          id={id}
          type="checkbox"
          className="field-check__input"
          aria-describedby={buildDescribedBy(id, { hint, error })}
          aria-invalid={!!error}
          {...rest}
        />
        {label && (
          <label htmlFor={id} className="field-check__item-label" style={{ cursor: 'pointer' }}>
            {label}
            {hint && <span className="field-check__item-hint" id={`${id}-hint`} style={{ display: 'block' }}>{hint}</span>}
          </label>
        )}
      </div>
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * RadioGroup
 * @param {string} name - radio group name
 * @param {Array<{value, label, hint}>} options
 * @param {string} value - current selected value
 * @param {Function} onChange - called with the new value string
 */
export function RadioGroup({
  id: propId,
  name,
  label,
  hint,
  error,
  options = [],
  value,
  onChange,
  className = '',
}) {
  const groupId = propId ?? genId('rg');
  return (
    <fieldset className={`field-check ${className}`} aria-describedby={buildDescribedBy(groupId, { hint, error })}>
      {label && <legend className="field-check__label">{label}</legend>}
      {hint && <p className="field__hint" id={`${groupId}-hint`}>{hint}</p>}
      {options.map((opt) => {
        const optId = `${groupId}-${opt.value}`;
        return (
          <div key={opt.value} className="field-check__item">
            <input
              id={optId}
              type="radio"
              className="field-check__input"
              name={name ?? groupId}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange?.(opt.value)}
            />
            <label htmlFor={optId} className="field-check__item-label" style={{ cursor: 'pointer' }}>
              {opt.label}
              {opt.hint && (
                <span className="field-check__item-hint" style={{ display: 'block' }}>
                  {opt.hint}
                </span>
              )}
            </label>
          </div>
        );
      })}
      {error && (
        <p className="field__error" id={`${groupId}-error`} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </fieldset>
  );
}

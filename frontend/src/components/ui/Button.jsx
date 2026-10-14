import './Button.css';

/**
 * Button
 * @param {'solid'|'outline'|'text'|'danger'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} loading
 * @param {boolean} disabled
 * @param {string} type - button type attribute
 * @param {string} as - render as 'button' or 'a'
 */
export default function Button({
  children,
  variant = 'solid',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  as: Tag = 'button',
  className = '',
  onClick,
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    loading ? 'btn--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag
      type={Tag === 'button' ? type : undefined}
      className={classes}
      disabled={Tag === 'button' ? (disabled || loading) : undefined}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      onClick={disabled || loading ? undefined : onClick}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </Tag>
  );
}

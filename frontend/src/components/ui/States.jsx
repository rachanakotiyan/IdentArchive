import { AlertCircle, FolderOpen } from 'lucide-react';
import Button from './Button.jsx';
import './States.css';

/**
 * EmptyState
 * @param {string} title
 * @param {string} description
 * @param {string} actionLabel - label for the CTA button
 * @param {Function} onAction
 * @param {React.ReactNode} icon
 */
export function EmptyState({
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  icon,
  className = '',
}) {
  return (
    <div className={`empty-state ${className}`} role="status">
      <div className="empty-state__icon" aria-hidden="true">
        {icon ?? <FolderOpen size={48} strokeWidth={1} />}
      </div>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {actionLabel && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * ErrorState
 * @param {string} title
 * @param {string} description
 * @param {string} error - raw error message (shown in smaller text)
 * @param {Function} onRetry
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading data.',
  error,
  onRetry,
  className = '',
}) {
  return (
    <div className={`error-state ${className}`} role="alert">
      <AlertCircle size={48} strokeWidth={1} className="error-state__icon" />
      <p className="error-state__title">{title}</p>
      <p className="error-state__description">{description}</p>
      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {error}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

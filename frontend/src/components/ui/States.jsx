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
 * @param {string|object} error - raw error message or ApiError object
 * @param {Function} onRetry
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading data.',
  error,
  onRetry,
  className = '',
}) {
  const is403 =
    (typeof error === 'object' && (error?.status === 403 || error?.code === 'FORBIDDEN')) ||
    (typeof error === 'string' &&
      (error.includes('403') || error.toLowerCase().includes('access denied') || error.toLowerCase().includes('forbidden')));

  const displayTitle = is403 ? 'Access denied' : title;
  const displayDescription = is403
    ? 'You do not have permission to view or perform this action.'
    : description;

  return (
    <div className={`error-state ${className}`} role="alert">
      <AlertCircle size={48} strokeWidth={1} className="error-state__icon" />
      <p className="error-state__title">{displayTitle}</p>
      <p className="error-state__description">{displayDescription}</p>
      {error && !is403 && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {typeof error === 'object' ? error.message : error}
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

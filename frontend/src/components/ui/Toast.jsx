import { CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import './Toast.css';

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  info:    Info,
};

function ToastItem({ id, message, type }) {
  const { dismiss } = useToast();
  const Icon = ICONS[type] ?? Info;

  return (
    <div
      className={`toast toast--${type}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon size={18} className={`toast__icon toast__icon--${type}`} strokeWidth={2} aria-hidden="true" />
      <span className="toast__message">{message}</span>
      <button
        className="toast__dismiss"
        onClick={() => dismiss(id)}
        aria-label="Dismiss notification"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * ToastProvider renders the toast region.
 * Wrap the app in ToastContext.ToastProvider (from context/ToastContext) first.
 */
export default function ToastRegion() {
  const { toasts } = useToast();

  return (
    <div className="toast-region" aria-label="Notifications">
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}

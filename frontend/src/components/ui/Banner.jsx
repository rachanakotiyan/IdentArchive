import { AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-react';
import './Banner.css';

const ICONS = {
  info:    Info,
  success: CheckCircle,
  warning: TriangleAlert,
  error:   AlertCircle,
};

/**
 * Banner
 * Top-of-page system notice.
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {string} title
 * @param {React.ReactNode} children
 */
export default function Banner({ type = 'info', title, children, className = '' }) {
  const Icon = ICONS[type] ?? Info;
  return (
    <div className={`banner banner--${type} ${className}`} role="status">
      <Icon size={18} className="banner__icon" aria-hidden="true" strokeWidth={2} />
      <div className="banner__content">
        {title && <div className="banner__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

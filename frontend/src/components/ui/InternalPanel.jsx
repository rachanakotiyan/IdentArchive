import { Lock } from 'lucide-react';
import './InternalPanel.css';

/**
 * InternalPanel
 * Wraps staff-only content with a visible "INTERNAL ONLY" marker.
 * Never use for public content.
 */
export default function InternalPanel({ children, className = '' }) {
  return (
    <div className={`internal-panel ${className}`} aria-label="Internal - staff only">
      <div className="internal-panel__header" aria-hidden="true">
        <Lock size={12} className="internal-panel__icon" strokeWidth={2} />
        Internal only
      </div>
      {children}
    </div>
  );
}

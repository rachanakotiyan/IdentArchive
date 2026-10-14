import './StatusStamp.css';

const LABELS = {
  // Case
  case: {
    open:         'Open',
    under_review: 'Under Review',
    resolved:     'Resolved',
    closed:       'Closed',
  },
  // Report
  report: {
    submitted:      'Received',
    under_review:   'Under Review',
    info_requested: 'Info Needed',
    approved:       'Approved',
    rejected:       'Rejected',
    closed:         'Closed',
  },
  // Match
  match: {
    pending:   'Pending',
    confirmed: 'Confirmed',
    dismissed: 'Dismissed',
  },
  // Priority
  priority: {
    low:    'Low',
    normal: 'Normal',
    high:   'High',
    urgent: 'Urgent',
  },
};

/**
 * StatusStamp
 * @param {'case'|'report'|'match'|'priority'} kind
 * @param {string} status
 * @param {string} className
 */
export default function StatusStamp({ kind, status, className = '' }) {
  const label = LABELS[kind]?.[status] ?? status;
  const mod   = `stamp--${kind}-${status}`;

  return (
    <span className={`stamp ${mod} ${className}`} aria-label={`Status: ${label}`}>
      {label}
    </span>
  );
}

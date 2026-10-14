import './Spinner.css';

/**
 * Spinner
 * @param {number}  size     - pixel size (default 24)
 * @param {boolean} fullPage - centres it in the viewport
 * @param {string}  label    - accessible label
 */
export default function Spinner({ size = 24, fullPage = false, label = 'Loading…' }) {
  return (
    <div
      className={`spinner-wrap${fullPage ? ' spinner-wrap--full' : ''}`}
      role="status"
      aria-label={label}
    >
      <div
        className="spinner"
        style={{ '--spinner-size': `${size}px` }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

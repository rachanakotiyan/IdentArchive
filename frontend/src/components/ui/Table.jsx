import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Table.css';

/**
 * Table
 * @param {string[]} columns - header labels
 * @param {React.ReactNode[][]} rows - array of cell content arrays
 * @param {string} caption - accessible table caption
 */
export function Table({ columns = [], rows = [], caption, className = '' }) {
  return (
    <div className={`table-wrapper ${className}`}>
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} scope="col">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pagination
 * @param {number} page       - 1-indexed current page
 * @param {number} total      - total items
 * @param {number} pageSize   - items per page
 * @param {Function} onPage   - called with new page number
 * @param {Function} onPageSize - called with new page size
 * @param {number[]} pageSizeOptions
 */
export function Pagination({
  page = 1,
  total = 0,
  pageSize = 10,
  onPage,
  onPageSize,
  pageSizeOptions = [10, 25, 50],
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  // Build page numbers: always show first, last, current ±1, with ellipsis
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="pagination">
      <div className="pagination__info">
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </div>
      <div className="pagination__controls" role="navigation" aria-label="Pagination">
        <button
          className="pagination__btn"
          onClick={() => onPage?.(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} style={{ padding: '0 4px', color: 'var(--muted)' }}>…</span>
          ) : (
            <button
              key={p}
              className="pagination__btn"
              onClick={() => onPage?.(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          className="pagination__btn"
          onClick={() => onPage?.(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
      {onPageSize && (
        <div className="pagination__size">
          <label htmlFor="page-size-select">Per page:</label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={e => onPageSize?.(Number(e.target.value))}
          >
            {pageSizeOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

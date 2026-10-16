import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, User } from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { Pagination } from '../../components/ui/Table.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listOfficers, listReports } from '../../services/staffService.js';
import './ReportsPage.css';

export default function ReportsPage() {
  useDocumentTitle('Staff Reports');
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'all');
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [assignedOfficer, setAssignedOfficer] = useState(searchParams.get('officer') || 'all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportsData, setReportsData] = useState({ items: [], total: 0 });
  const [officers, setOfficers] = useState([]);

  // Load officer list for filter dropdown
  useEffect(() => {
    let isMounted = true;
    listOfficers()
      .then(({ items }) => {
        if (isMounted) setOfficers(items);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  // Sync state to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (type !== 'all') params.set('type', type);
    if (assignedOfficer !== 'all') params.set('officer', assignedOfficer);
    if (debouncedQuery) params.set('q', debouncedQuery);
    setSearchParams(params, { replace: true });
  }, [status, priority, type, assignedOfficer, debouncedQuery, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    async function loadReports() {
      try {
        const filters = {
          status: status !== 'all' ? status : undefined,
          priority: priority !== 'all' ? priority : undefined,
          type: type !== 'all' ? type : undefined,
          assignedOfficer: assignedOfficer !== 'all' ? assignedOfficer : undefined,
          query: debouncedQuery || undefined,
        };
        const res = await listReports(filters, page, pageSize);
        if (!ignore) {
          setReportsData(res);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch reports.');
          setLoading(false);
        }
      }
    }
    loadReports();
    return () => {
      ignore = true;
    };
  }, [status, priority, type, assignedOfficer, debouncedQuery, page, pageSize]);

  const handleResetFilters = () => {
    setStatus('all');
    setPriority('all');
    setType('all');
    setAssignedOfficer('all');
    setQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const hasActiveFilters =
    status !== 'all' ||
    priority !== 'all' ||
    type !== 'all' ||
    assignedOfficer !== 'all' ||
    Boolean(debouncedQuery);

  return (
    <StaffLayout>
      <div className="staff-reports-page">
        <header className="staff-reports-page__header">
          <div className="staff-reports-page__title-wrap">
            <h1>Reports Intake & Review</h1>
            <p className="staff-reports-page__subtitle">
              Comfortable-row intake queue with multi-attribute filtering and direct casework actions.
            </p>
          </div>
        </header>

        {/* Filters Bar */}
        <section className="reports-filter-card" aria-label="Reports filtering options">
          <div className="reports-filter-grid">
            {/* Search by reference number / keyword */}
            <div className="filter-input-wrap">
              <label htmlFor="report-search">Search Reference / Name</label>
              <div className="filter-search-box">
                <Search size={16} className="filter-search-icon" />
                <input
                  id="report-search"
                  type="search"
                  placeholder="e.g. REF-2026... or name"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="filter-search-input"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="filter-input-wrap">
              <label htmlFor="filter-status">Status</label>
              <select
                id="filter-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All statuses</option>
                <option value="submitted">Received (Submitted)</option>
                <option value="under_review">Under Review</option>
                <option value="info_requested">Info Needed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="filter-input-wrap">
              <label htmlFor="filter-priority">Priority</label>
              <select
                id="filter-priority"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="filter-input-wrap">
              <label htmlFor="filter-type">Type</label>
              <select
                id="filter-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All types</option>
                <option value="missing">Missing person</option>
                <option value="found">Found person</option>
              </select>
            </div>

            {/* Assigned Officer Filter */}
            <div className="filter-input-wrap">
              <label htmlFor="filter-officer">Assigned Officer</label>
              <select
                id="filter-officer"
                value={assignedOfficer}
                onChange={(e) => {
                  setAssignedOfficer(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All assignments</option>
                <option value="unassigned">Unassigned only</option>
                {officers.map((o) => (
                  <option key={o.officerId} value={o.officerId}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset */}
            <div className="filter-input-wrap" style={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="md"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                aria-label="Reset all filters"
                style={{ height: '38px' }}
              >
                <RotateCcw size={14} style={{ marginRight: '6px' }} />
                Reset
              </Button>
            </div>
          </div>
        </section>

        {/* Content Section */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
            <Spinner size={32} label="Loading reports..." />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Failed to load reports"
            description="We were unable to retrieve the report records at this time."
            error={error}
            onRetry={fetchReports}
          />
        )}

        {!loading && !error && reportsData.items.length === 0 && (
          <EmptyState
            title="No reports match your filters"
            description={
              hasActiveFilters
                ? 'Try adjusting or clearing your search and filter criteria.'
                : 'There are currently no reports recorded in the system.'
            }
            actionLabel={hasActiveFilters ? 'Clear all filters' : undefined}
            onAction={handleResetFilters}
          />
        )}

        {!loading && !error && reportsData.items.length > 0 && (
          <section className="reports-table-wrap" aria-label="Reports list">
            {/* Desktop & Tablet Table */}
            <div className="reports-table-desktop">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Type</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned Officer</th>
                    <th scope="col">Date Reported</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsData.items.map((report) => (
                    <tr key={report.reportId}>
                      <td>
                        <Link
                          to={`/staff/reports/${report.reportId}`}
                          className="report-ref-link"
                          aria-label={`View report ${report.referenceNo}`}
                        >
                          {report.referenceNo}
                        </Link>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            color: report.reportType === 'missing' ? 'var(--accent)' : 'var(--success)',
                          }}
                        >
                          {report.reportType}
                        </span>
                      </td>
                      <td>
                        <div className="report-subject-cell">
                          <span className="report-subject-name">
                            {report.person?.name || 'Unidentified'}
                          </span>
                          <span className="report-subject-city">
                            {report.location?.city || report.location?.district || 'Location recorded'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusStamp kind="priority" status={report.priority} />
                      </td>
                      <td>
                        <StatusStamp kind="report" status={report.status} />
                      </td>
                      <td>
                        {report.assignedOfficer ? (
                          <span className="officer-badge">
                            <User size={13} style={{ color: 'var(--muted)' }} />
                            {report.assignedOfficer.name}
                          </span>
                        ) : (
                          <span className="officer-badge officer-badge--unassigned">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                        {report.dateReported}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          as={Link}
                          to={`/staff/reports/${report.reportId}`}
                          size="sm"
                          variant="outline"
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards (Visible below 768px and down to 360px) */}
            <div className="reports-mobile-cards" role="list">
              {reportsData.items.map((report) => (
                <div key={report.reportId} className="report-card-item" role="listitem">
                  <div className="report-card-item__top">
                    <Link
                      to={`/staff/reports/${report.reportId}`}
                      className="report-ref-link"
                      style={{ fontSize: 'var(--text-sm)' }}
                    >
                      {report.referenceNo}
                    </Link>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: report.reportType === 'missing' ? 'var(--accent)' : 'var(--success)',
                      }}
                    >
                      {report.reportType}
                    </span>
                  </div>

                  <div className="report-card-item__subject">
                    {report.person?.name || 'Unidentified individual'}
                  </div>

                  <div className="report-card-item__details">
                    <div className="report-card-field">
                      <span className="report-card-field__label">Priority</span>
                      <div className="report-card-field__value">
                        <StatusStamp kind="priority" status={report.priority} />
                      </div>
                    </div>
                    <div className="report-card-field">
                      <span className="report-card-field__label">Status</span>
                      <div className="report-card-field__value">
                        <StatusStamp kind="report" status={report.status} />
                      </div>
                    </div>
                    <div className="report-card-field">
                      <span className="report-card-field__label">Officer</span>
                      <span className="report-card-field__value">
                        {report.assignedOfficer?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="report-card-field">
                      <span className="report-card-field__label">Reported</span>
                      <span className="report-card-field__value" style={{ fontFamily: 'var(--font-mono)' }}>
                        {report.dateReported}
                      </span>
                    </div>
                  </div>

                  <div className="report-card-item__bottom">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                      {report.location?.city || report.location?.district || ''}
                    </span>
                    <Button
                      as={Link}
                      to={`/staff/reports/${report.reportId}`}
                      size="sm"
                      variant="solid"
                    >
                      Review Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination with page-size selector */}
            <Pagination
              page={page}
              total={reportsData.total}
              pageSize={pageSize}
              onPage={(newPage) => setPage(newPage)}
              onPageSize={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
            />
          </section>
        )}
      </div>
    </StaffLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderOpen, RotateCcw, Search } from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import CaseIcon from '../../components/ui/CaseIcon.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { Pagination } from '../../components/ui/Table.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listCases } from '../../services/staffService.js';
import './CasesPage.css';

export default function CasesPage() {
  useDocumentTitle('Staff Cases');
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [kind, setKind] = useState(searchParams.get('kind') || 'all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [casesData, setCasesData] = useState({ items: [], total: 0 });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (kind !== 'all') params.set('kind', kind);
    if (debouncedQuery) params.set('q', debouncedQuery);
    setSearchParams(params, { replace: true });
  }, [status, kind, debouncedQuery, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    async function loadCases() {
      try {
        const filters = {
          caseStatus: status !== 'all' ? status : undefined,
          kind: kind !== 'all' ? kind : undefined,
          query: debouncedQuery || undefined,
        };
        const res = await listCases(filters, page, pageSize);
        if (!ignore) {
          setCasesData(res);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch cases.');
          setLoading(false);
        }
      }
    }
    loadCases();
    return () => {
      ignore = true;
    };
  }, [status, kind, debouncedQuery, page, pageSize]);

  const handleResetFilters = () => {
    setStatus('all');
    setKind('all');
    setQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const hasActiveFilters = status !== 'all' || kind !== 'all' || Boolean(debouncedQuery);

  return (
    <StaffLayout>
      <div className="staff-cases-page">
        <header className="staff-cases-page__header">
          <div className="staff-cases-page__title-wrap">
            <h1>Active Case Dossiers</h1>
            <p className="staff-cases-page__subtitle">
              Official records of opened, under-review, and resolved cases.
            </p>
          </div>
        </header>

        {/* Filters */}
        <section className="cases-filter-card" aria-label="Cases filter controls">
          <div className="cases-filter-grid">
            <div className="filter-input-wrap">
              <label htmlFor="case-search">Search Case Number / Person / City</label>
              <div className="filter-search-box">
                <Search size={16} className="filter-search-icon" />
                <input
                  id="case-search"
                  type="search"
                  placeholder="e.g. IA-2026-0001, name or city"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="filter-search-input"
                />
              </div>
            </div>

            <div className="filter-input-wrap">
              <label htmlFor="case-filter-status">Case Status</label>
              <select
                id="case-filter-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="filter-input-wrap">
              <label htmlFor="case-filter-kind">Record Kind</label>
              <select
                id="case-filter-kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All kinds</option>
                <option value="missing">Missing person</option>
                <option value="found">Found person</option>
              </select>
            </div>

            <div className="filter-input-wrap" style={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="md"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                aria-label="Reset case filters"
                style={{ height: '38px' }}
              >
                <RotateCcw size={14} style={{ marginRight: '6px' }} />
                Reset
              </Button>
            </div>
          </div>
        </section>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
            <Spinner size={32} label="Loading cases..." />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Failed to load cases"
            description="We were unable to load the case dossiers."
            error={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
            }}
          />
        )}

        {!loading && !error && casesData.items.length === 0 && (
          <EmptyState
            title="No cases match your filters"
            description={
              hasActiveFilters
                ? 'Try adjusting or clearing your search query or filters.'
                : 'There are currently no case dossiers recorded.'
            }
            actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
            onAction={handleResetFilters}
            icon={<FolderOpen size={48} />}
          />
        )}

        {!loading && !error && casesData.items.length > 0 && (
          <section className="cases-table-wrap" aria-label="Cases table">
            {/* Desktop / Tablet Table */}
            <div className="cases-table-desktop">
              <table className="cases-table">
                <thead>
                  <tr>
                    <th scope="col">Case Number</th>
                    <th scope="col">Type</th>
                    <th scope="col">Subject / Title</th>
                    <th scope="col">Status</th>
                    <th scope="col">Location</th>
                    <th scope="col">Date</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {casesData.items.map((c) => (
                    <tr key={c.caseId}>
                      <td>
                        <Link to={`/staff/cases/${c.caseId}`} className="case-num-link">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CaseIcon crimeType={c.crimeType} size={16} />
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-xs)',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                              color: c.kind === 'missing' ? 'var(--accent)' : 'var(--success)',
                            }}
                          >
                            {c.kind}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ color: 'var(--ink)' }}>{c.personName || c.title}</strong>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                            {c.shortDescription}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusStamp kind="case" status={c.caseStatus} />
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>
                        {c.city ? `${c.city}, ${c.state}` : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                        {c.date}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          as={Link}
                          to={`/staff/cases/${c.caseId}`}
                          size="sm"
                          variant="outline"
                        >
                          Dossier
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="cases-mobile-cards" role="list">
              {casesData.items.map((c) => (
                <div key={c.caseId} className="case-card-item" role="listitem">
                  <div className="case-card-item__top">
                    <Link to={`/staff/cases/${c.caseId}`} className="case-num-link" style={{ fontSize: 'var(--text-sm)' }}>
                      {c.caseNumber}
                    </Link>
                    <StatusStamp kind="case" status={c.caseStatus} />
                  </div>

                  <div className="case-card-item__title">
                    {c.personName || c.title}
                  </div>

                  <div className="case-card-item__details">
                    <div>
                      <span style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Type</span>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{c.kind}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Location</span>
                      <span>{c.city || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Date</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{c.date}</span>
                    </div>
                  </div>

                  <div className="case-card-item__bottom">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{c.district || c.state || ''}</span>
                    <Button as={Link} to={`/staff/cases/${c.caseId}`} size="sm" variant="solid">
                      View Dossier
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              total={casesData.total}
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

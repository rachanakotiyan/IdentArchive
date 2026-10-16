import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, Sparkles } from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { Pagination } from '../../components/ui/Table.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listMatches } from '../../services/staffService.js';
import './MatchesPage.css';

export default function MatchesPage() {
  useDocumentTitle('Staff Matches');
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matchesData, setMatchesData] = useState({ items: [], total: 0 });

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
    if (debouncedQuery) params.set('q', debouncedQuery);
    setSearchParams(params, { replace: true });
  }, [status, debouncedQuery, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    async function loadMatches() {
      try {
        const filters = {
          status: status !== 'all' ? status : undefined,
          query: debouncedQuery || undefined,
        };
        const res = await listMatches(filters, page, pageSize);
        if (!ignore) {
          setMatchesData(res);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch matches.');
          setLoading(false);
        }
      }
    }
    loadMatches();
    return () => {
      ignore = true;
    };
  }, [status, debouncedQuery, page, pageSize]);

  const handleResetFilters = () => {
    setStatus('all');
    setQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const hasActiveFilters = status !== 'all' || Boolean(debouncedQuery);

  return (
    <StaffLayout>
      <div className="staff-matches-page">
        <header className="staff-matches-page__header">
          <div className="staff-matches-page__title-wrap">
            <h1>Candidate Matches & Cross-Referencing</h1>
            <p className="staff-matches-page__subtitle">
              Algorithmic associations between reported missing persons and unidentified found individuals.
            </p>
          </div>
        </header>

        {/* Filters */}
        <section className="matches-filter-card" aria-label="Matches filtering">
          <div className="matches-filter-grid">
            <div className="filter-input-wrap">
              <label htmlFor="match-search">Search Match ID / Case / Person / Place</label>
              <div className="filter-search-box">
                <Search size={16} className="filter-search-icon" />
                <input
                  id="match-search"
                  type="search"
                  placeholder="e.g. match-001, IA-2026-..., name or place"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="filter-search-input"
                />
              </div>
            </div>

            <div className="filter-input-wrap">
              <label htmlFor="match-filter-status">Match Status</label>
              <select
                id="match-filter-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            <div className="filter-input-wrap" style={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="md"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                aria-label="Reset match filters"
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
            <Spinner size={32} label="Loading candidate matches..." />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Failed to load matches"
            description="Unable to load match comparisons at this time."
            error={error}
          />
        )}

        {!loading && !error && matchesData.items.length === 0 && (
          <EmptyState
            title="No candidate matches found"
            description={
              hasActiveFilters
                ? 'Try adjusting or clearing your search query or status filter.'
                : 'There are currently no recorded matches requiring review.'
            }
            actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
            onAction={handleResetFilters}
            icon={<Sparkles size={48} />}
          />
        )}

        {!loading && !error && matchesData.items.length > 0 && (
          <section className="matches-table-wrap" aria-label="Matches table">
            {/* Desktop Table */}
            <div className="matches-table-desktop">
              <table className="matches-table">
                <thead>
                  <tr>
                    <th scope="col">Match ID</th>
                    <th scope="col">Missing Person Record</th>
                    <th scope="col">Found Person Record</th>
                    <th scope="col">Similarity Score</th>
                    <th scope="col">Status</th>
                    <th scope="col">Verifications</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesData.items.map((m) => {
                    const pct = Math.round(m.similarityScore * 100);
                    const isHigh = pct >= 85;
                    return (
                      <tr key={m.matchId}>
                        <td>
                          <Link to={`/staff/matches/${m.matchId}`} className="match-id-link">
                            {m.matchId}
                          </Link>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <strong style={{ color: 'var(--ink)' }}>
                              {m.missing?.personName || 'Named Missing'}
                            </strong>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
                              {m.missing?.caseNumber} • {m.missing?.city}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <strong style={{ color: 'var(--ink)' }}>
                              {m.found?.personName || `Unidentified (${m.found?.estimatedAge || 'age unk.'})`}
                            </strong>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                              {m.found?.caseNumber} • {m.found?.city}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`similarity-badge ${isHigh ? 'similarity-badge--high' : 'similarity-badge--med'}`}>
                            <Sparkles size={12} /> {pct}%
                          </span>
                        </td>
                        <td>
                          <StatusStamp kind="match" status={m.status} />
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                          {m.verifications?.length || 0} entry
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button as={Link} to={`/staff/matches/${m.matchId}`} size="sm" variant="outline">
                            Review Match
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="matches-mobile-cards" role="list">
              {matchesData.items.map((m) => {
                const pct = Math.round(m.similarityScore * 100);
                const isHigh = pct >= 85;
                return (
                  <div key={m.matchId} className="match-card-item" role="listitem">
                    <div className="match-card-item__top">
                      <Link to={`/staff/matches/${m.matchId}`} className="match-id-link" style={{ fontSize: 'var(--text-sm)' }}>
                        {m.matchId}
                      </Link>
                      <StatusStamp kind="match" status={m.status} />
                    </div>

                    <div className="match-card-item__comparison">
                      <div>
                        <span style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Missing</span>
                        <strong>{m.missing?.personName || 'Named record'}</strong>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '11px' }}>
                          {m.missing?.caseNumber}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Found</span>
                        <strong>{m.found?.personName || 'Unidentified'}</strong>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontSize: '11px' }}>
                          {m.found?.caseNumber}
                        </div>
                      </div>
                    </div>

                    <div className="match-card-item__bottom">
                      <span className={`similarity-badge ${isHigh ? 'similarity-badge--high' : 'similarity-badge--med'}`}>
                        <Sparkles size={12} /> {pct}% similarity
                      </span>
                      <Button as={Link} to={`/staff/matches/${m.matchId}`} size="sm" variant="solid">
                        Review Match
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              total={matchesData.total}
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

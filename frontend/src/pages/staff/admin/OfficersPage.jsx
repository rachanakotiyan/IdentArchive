import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, RotateCcw, Search, Shield } from 'lucide-react';
import { StaffLayout } from '../../../components/layout/StaffLayout.jsx';
import Button from '../../../components/ui/Button.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../../components/ui/States.jsx';
import { Pagination } from '../../../components/ui/Table.jsx';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { listOfficers } from '../../../services/staffService.js';
import './AdminPages.css';

export default function OfficersPage() {
  useDocumentTitle('Admin - Officers Roster');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [officersData, setOfficersData] = useState({ items: [], total: 0 });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await listOfficers({ query: debouncedQuery }, page, pageSize);
        if (!ignore) {
          setOfficersData(res);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load officers roster.');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [debouncedQuery, page, pageSize]);

  return (
    <StaffLayout>
      <div className="admin-directory-page">
        <header className="admin-directory-page__header">
          <div className="admin-directory-page__title-wrap">
            <h1>Active Officers Roster</h1>
            <p className="admin-directory-page__subtitle">
              Read-only system administrator roster of verified investigating officers, badges, and assigned districts.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
            <Shield size={14} /> Admin Console
          </div>
        </header>

        {/* Search */}
        <div className="admin-search-bar">
          <div className="filter-search-box" style={{ flex: 1 }}>
            <Search size={16} className="filter-search-icon" />
            <input
              type="search"
              placeholder="Search by officer name, badge number, or district..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="filter-search-input"
            />
          </div>
          {query && (
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>
              <RotateCcw size={14} style={{ marginRight: '4px' }} /> Clear
            </Button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
            <Spinner size={32} label="Loading officers roster..." />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Access Restricted or Failed"
            description="Could not load the officers directory."
            error={error}
          />
        )}

        {!loading && !error && officersData.items.length === 0 && (
          <EmptyState
            title="No Officers Found"
            description={query ? 'No officer records match your search criteria.' : 'No officer records exist.'}
            actionLabel={query ? 'Clear search' : undefined}
            onAction={() => setQuery('')}
            icon={<BadgeCheck size={48} />}
          />
        )}

        {!loading && !error && officersData.items.length > 0 && (
          <section className="admin-table-wrap" aria-label="Officers list">
            {/* Desktop Table */}
            <div className="admin-table-desktop">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Officer ID</th>
                    <th scope="col">Officer Name</th>
                    <th scope="col">Badge Number</th>
                    <th scope="col">Jurisdiction / District</th>
                    <th scope="col">Duty Status</th>
                  </tr>
                </thead>
                <tbody>
                  {officersData.items.map((o) => (
                    <tr key={o.officerId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
                        {o.officerId}
                      </td>
                      <td style={{ fontWeight: 600 }}>{o.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                        {o.badge}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{o.district}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                          <CheckCircle2 size={13} /> Active Duty
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="admin-mobile-cards" role="list">
              {officersData.items.map((o) => (
                <div key={o.officerId} className="admin-card-item" role="listitem">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{o.name}</strong>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      {o.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    District: {o.district} • ID: {o.officerId}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                    Active Duty
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={page}
              total={officersData.total}
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

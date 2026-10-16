import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, Search, Shield, Users } from 'lucide-react';
import { StaffLayout } from '../../../components/layout/StaffLayout.jsx';
import Button from '../../../components/ui/Button.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../../components/ui/States.jsx';
import { Pagination } from '../../../components/ui/Table.jsx';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { listUsers } from '../../../services/staffService.js';
import './AdminPages.css';

export default function UsersPage() {
  useDocumentTitle('Admin - Users Directory');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usersData, setUsersData] = useState({ items: [], total: 0 });

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
        const res = await listUsers({ query: debouncedQuery }, page, pageSize);
        if (!ignore) {
          setUsersData(res);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load users list.');
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
            <h1>User Accounts Directory</h1>
            <p className="admin-directory-page__subtitle">
              Read-only system administrator access to registered platform users and credentials status.
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
              placeholder="Search by name, email, phone, or role..."
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
            <Spinner size={32} label="Loading users directory..." />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Access Restricted or Failed"
            description="Could not retrieve the user accounts directory."
            error={error}
          />
        )}

        {!loading && !error && usersData.items.length === 0 && (
          <EmptyState
            title="No Users Found"
            description={query ? 'No registered users match your search criteria.' : 'No users exist in the system.'}
            actionLabel={query ? 'Clear search' : undefined}
            onAction={() => setQuery('')}
            icon={<Users size={48} />}
          />
        )}

        {!loading && !error && usersData.items.length > 0 && (
          <section className="admin-table-wrap" aria-label="Users list">
            {/* Desktop Table */}
            <div className="admin-table-desktop">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">User ID</th>
                    <th scope="col">Full Name</th>
                    <th scope="col">Email Address</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Platform Role</th>
                    <th scope="col">Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.items.map((u) => (
                    <tr key={u.userId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
                        {u.userId}
                      </td>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                        {u.email}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                        {u.phone || '—'}
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background:
                              u.role === 'admin'
                                ? 'var(--danger-subtle)'
                                : u.role === 'officer'
                                ? 'var(--accent-subtle)'
                                : 'var(--surface-2)',
                            color:
                              u.role === 'admin'
                                ? 'var(--danger)'
                                : u.role === 'officer'
                                ? 'var(--accent)'
                                : 'var(--ink)',
                            border: `1px solid ${
                              u.role === 'admin'
                                ? 'var(--danger)'
                                : u.role === 'officer'
                                ? 'var(--accent)'
                                : 'var(--line)'
                            }`,
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                          <CheckCircle2 size={13} /> Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="admin-mobile-cards" role="list">
              {usersData.items.map((u) => (
                <div key={u.userId} className="admin-card-item" role="listitem">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{u.name}</strong>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                      {u.role}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    {u.email}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    Phone: {u.phone || 'None'} • ID: {u.userId}
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={page}
              total={usersData.total}
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

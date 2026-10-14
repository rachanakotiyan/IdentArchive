import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { listCases } from '../../services/publicService.js';
import Button from '../../components/ui/Button.jsx';
import CaseIcon from '../../components/ui/CaseIcon.jsx';
import Card from '../../components/ui/Card.jsx';
import { DateField, SelectField, TextField } from '../../components/ui/Fields.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { Pagination } from '../../components/ui/Table.jsx';
import './CasesPage.css';

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZES = [6, 12, 24];

function readSavedView() {
  try {
    return localStorage.getItem('ia-case-view') === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(value) {
  if (!value) return 'Date not provided';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function getPlace(caseItem) {
  return [caseItem.city, caseItem.state].filter(Boolean).join(', ') || 'Place not provided';
}

function CaseCard({ caseItem, view }) {
  const displayName = caseItem.personName || caseItem.title || 'Unidentified person';
  const placeLabel = caseItem.kind === 'found' ? 'Found near' : 'Last seen';

  return (
    <Link
      to={`/cases/${caseItem.caseId}`}
      className={`case-card case-card--${view}`}
      aria-label={`${displayName}, ${caseItem.caseStatus.replaceAll('_', ' ')}`}
    >
      <Card interactive className="case-card__surface">
        <div className="case-card__top">
          <span className="case-card__icon"><CaseIcon crimeType={caseItem.crimeType} size="lg" /></span>
          <StatusStamp kind="case" status={caseItem.caseStatus} />
        </div>
        <div className="case-card__body">
          <p className="case-card__number">{caseItem.caseNumber}</p>
          <h2 className="case-card__title" title={displayName}>{displayName}</h2>
          {caseItem.age != null && (
            <p className="case-card__age">{caseItem.age} years old</p>
          )}
          {caseItem.age == null && caseItem.estimatedAge && (
            <p className="case-card__age">Estimated age {caseItem.estimatedAge}</p>
          )}
          <p className="case-card__description">{caseItem.shortDescription || 'No public description is available.'}</p>
        </div>
        <div className="case-card__place">
          <span>{placeLabel}</span>
          <strong title={getPlace(caseItem)}>{getPlace(caseItem)}</strong>
          <time dateTime={caseItem.date || undefined}>{formatDate(caseItem.date)}</time>
        </div>
      </Card>
    </Link>
  );
}

function CaseCardSkeleton({ view }) {
  return (
    <Card className={`case-card-skeleton case-card-skeleton--${view}`} aria-hidden="true">
      <div className="case-card__top">
        <Skeleton shape="circle" width={48} height={48} />
        <Skeleton width="92px" height="22px" />
      </div>
      <Skeleton width="45%" height="12px" style={{ marginTop: '18px' }} />
      <Skeleton width="78%" height="22px" style={{ marginTop: '10px' }} />
      <Skeleton width="92%" height="14px" style={{ marginTop: '14px' }} />
      <Skeleton width="80%" height="14px" style={{ marginTop: '8px' }} />
      <Skeleton width="60%" height="12px" style={{ marginTop: '20px' }} />
    </Card>
  );
}

function CaseSearchForm({ query, onSearch }) {
  const [searchText, setSearchText] = useState(query);

  return (
    <form
      className="cases-search__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(searchText.trim());
      }}
    >
      <TextField
        id="case-search"
        label="Search cases"
        placeholder="Name, case number or place"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
      />
      <Button type="submit" variant="solid"><Search size={16} /> Search</Button>
    </form>
  );
}

function useCasesQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => ({
    kind: searchParams.get('kind') || '',
    query: searchParams.get('query') || '',
    status: searchParams.get('status') || '',
    gender: searchParams.get('gender') || '',
    minAge: searchParams.get('minAge') || '',
    maxAge: searchParams.get('maxAge') || '',
    fromDate: searchParams.get('fromDate') || '',
    toDate: searchParams.get('toDate') || '',
    sort: searchParams.get('sort') || 'newest',
    page: toPositiveInteger(searchParams.get('page'), 1),
    pageSize: PAGE_SIZES.includes(Number(searchParams.get('pageSize')))
      ? Number(searchParams.get('pageSize'))
      : DEFAULT_PAGE_SIZE,
  }), [searchParams]);

  const updateParams = useCallback((changes, { resetPage = true, replace = false } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === '' || value == null || (key === 'page' && value === 1)) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage && !Object.hasOwn(changes, 'page')) next.delete('page');
      return next;
    }, { replace });
  }, [setSearchParams]);

  return [params, updateParams];
}

export default function CasesPage() {
  const [filters, updateParams] = useCasesQuery();
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState(readSavedView);
  const requestKey = JSON.stringify([filters, retry]);
  const [resultState, setResultState] = useState({ key: null, items: [], total: 0, error: null });
  const loading = resultState.key !== requestKey;
  const items = loading ? [] : resultState.items;
  const total = loading ? 0 : resultState.total;
  const error = loading ? null : resultState.error;

  useEffect(() => {
    document.title = 'Browse public cases | IdentArchive';
  }, []);

  useEffect(() => {
    let active = true;
    listCases({
      kind: filters.kind || undefined,
      query: filters.query || undefined,
      status: filters.status || undefined,
      gender: filters.gender || undefined,
      minAge: filters.minAge || undefined,
      maxAge: filters.maxAge || undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      sort: filters.sort,
    }, filters.page, filters.pageSize)
      .then((result) => {
        if (!active) return;
        setResultState({ key: requestKey, items: result.items, total: result.total, error: null });
      })
      .catch((caughtError) => {
        if (!active) return;
        setResultState({
          key: requestKey,
          items: [],
          total: 0,
          error: caughtError instanceof Error ? caughtError.message : 'Unable to load public cases.',
        });
      });
    return () => { active = false; };
  }, [filters, requestKey]);

  useEffect(() => {
    try {
      localStorage.setItem('ia-case-view', view);
    } catch {
      // Keep the selected view for this page even when storage is unavailable.
    }
  }, [view]);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(total / filters.pageSize));
    if (!loading && filters.page > lastPage) {
      updateParams({ page: lastPage }, { resetPage: false, replace: true });
    }
  }, [filters.page, filters.pageSize, loading, total, updateParams]);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (filters.kind) chips.push({ key: 'kind', label: filters.kind === 'missing' ? 'Missing' : 'Found' });
    if (filters.query) chips.push({ key: 'query', label: `Search: ${filters.query}` });
    if (filters.status) chips.push({ key: 'status', label: `Status: ${filters.status.replaceAll('_', ' ')}` });
    if (filters.gender) chips.push({ key: 'gender', label: `Gender: ${filters.gender}` });
    if (filters.minAge || filters.maxAge) {
      chips.push({ key: 'age', label: `Age: ${filters.minAge || 'any'}–${filters.maxAge || 'any'}` });
    }
    if (filters.fromDate || filters.toDate) {
      chips.push({ key: 'date', label: `Date: ${filters.fromDate || 'any'} – ${filters.toDate || 'any'}` });
    }
    return chips;
  }, [filters]);

  const clearFilters = () => updateParams({
      kind: '',
      query: '',
      status: '',
      gender: '',
      minAge: '',
      maxAge: '',
      fromDate: '',
      toDate: '',
      sort: '',
      page: '',
    }, { resetPage: false });

  const removeFilter = (key) => {
    const changes = key === 'age'
      ? { minAge: '', maxAge: '' }
      : key === 'date'
        ? { fromDate: '', toDate: '' }
        : { [key]: '' };
    updateParams(changes);
  };

  const changeView = (nextView) => setView(nextView);

  const advancedOpen = Boolean(filters.status || filters.gender || filters.minAge || filters.maxAge || filters.fromDate || filters.toDate);
  return (
    <main className="cases-page">
      <header className="cases-page__header">
        <p className="cases-page__eyebrow">Public case archive</p>
        <h1>Browse cases</h1>
        <p>Search public missing and found person records. If you have information, contact the helpline listed on each case.</p>
      </header>

      <section className="cases-search" aria-label="Case search and filters">
        <div className="cases-kind-switch" role="group" aria-label="Case type">
          <Button variant={filters.kind === 'missing' ? 'solid' : 'outline'} onClick={() => updateParams({ kind: 'missing' })}>Missing</Button>
          <Button variant={filters.kind === 'found' ? 'solid' : 'outline'} onClick={() => updateParams({ kind: 'found' })}>Found</Button>
          <Button variant={!filters.kind ? 'solid' : 'outline'} size="sm" onClick={() => updateParams({ kind: '' })}>All cases</Button>
        </div>

        <CaseSearchForm
          key={filters.query}
          query={filters.query}
          onSearch={(query) => updateParams({ query })}
        />

        <details className="cases-advanced" open={advancedOpen || undefined}>
          <summary><SlidersHorizontal size={16} /> Advanced filters</summary>
          <div className="cases-advanced__fields">
            <SelectField
              id="case-status"
              label="Status"
              value={filters.status}
              onChange={(event) => updateParams({ status: event.target.value })}
            >
              <option value="">Any status</option>
              <option value="open">Open</option>
              <option value="under_review">Under review</option>
              <option value="resolved">Resolved</option>
            </SelectField>
            <SelectField
              id="case-gender"
              label="Gender"
              value={filters.gender}
              onChange={(event) => updateParams({ gender: event.target.value })}
            >
              <option value="">Any</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unknown">Unknown / not stated</option>
            </SelectField>
            <TextField
              id="case-min-age"
              label="Minimum age"
              type="number"
              min="0"
              max="120"
              inputMode="numeric"
              value={filters.minAge}
              onChange={(event) => updateParams({ minAge: event.target.value })}
            />
            <TextField
              id="case-max-age"
              label="Maximum age"
              type="number"
              min="0"
              max="120"
              inputMode="numeric"
              value={filters.maxAge}
              onChange={(event) => updateParams({ maxAge: event.target.value })}
            />
            <DateField
              id="case-from-date"
              label="From date"
              value={filters.fromDate}
              onChange={(event) => updateParams({ fromDate: event.target.value })}
            />
            <DateField
              id="case-to-date"
              label="To date"
              value={filters.toDate}
              onChange={(event) => updateParams({ toDate: event.target.value })}
            />
          </div>
        </details>
      </section>

      {activeFilters.length > 0 && (
        <div className="cases-filter-chips" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button key={filter.key} type="button" className="cases-filter-chip" onClick={() => removeFilter(filter.key)}>
              <span>{filter.label}</span><X size={14} aria-hidden="true" /><span className="sr-only">Remove filter</span>
            </button>
          ))}
          <Button variant="text" size="sm" onClick={clearFilters}>Clear all</Button>
        </div>
      )}

      <section className="cases-results" aria-label="Case results">
        <div className="cases-results__toolbar">
          <p className="cases-results__count" aria-live="polite">
            {loading ? 'Loading cases…' : `${total} ${total === 1 ? 'case' : 'cases'} found`}
          </p>
          <div className="cases-results__controls">
            <label className="cases-sort">
              <ArrowDownUp size={15} aria-hidden="true" />
              <span className="sr-only">Sort cases</span>
              <select aria-label="Sort cases" value={filters.sort} onChange={(event) => updateParams({ sort: event.target.value })}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
            <div className="cases-view-toggle" role="group" aria-label="Results layout">
              <button type="button" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}><LayoutGrid size={17} /></button>
              <button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => changeView('list')}><List size={17} /></button>
            </div>
          </div>
        </div>

        {error ? (
          <ErrorState
            title="Cases could not be loaded"
            description="Please check your connection and try again."
            error={error}
            onRetry={() => setRetry((value) => value + 1)}
          />
        ) : loading ? (
          <div className={`cases-grid cases-grid--${view}`} aria-label="Loading cases">
            {Array.from({ length: Math.min(filters.pageSize, 6) }, (_, index) => <CaseCardSkeleton key={index} view={view} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No cases match these filters"
            description="Try a wider search or clear filters to see all public cases."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        ) : (
          <>
            <div className={`cases-grid cases-grid--${view}`}>
              {items.map((caseItem) => <CaseCard key={caseItem.caseId} caseItem={caseItem} view={view} />)}
            </div>
            <div className="cases-pagination">
              <Pagination
                page={filters.page}
                total={total}
                pageSize={filters.pageSize}
                pageSizeOptions={PAGE_SIZES}
                onPage={(page) => updateParams({ page }, { resetPage: false })}
                onPageSize={(pageSize) => updateParams({ pageSize, page: '' }, { resetPage: false })}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

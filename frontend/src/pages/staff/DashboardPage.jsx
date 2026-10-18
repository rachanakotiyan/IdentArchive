import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileQuestion,
  FileText,
  FolderOpen,
  Sparkles,
  UserX,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import FileTabHeading from '../../components/ui/FileTabHeading.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getDashboard } from '../../services/staffService.js';
import './DashboardPage.css';

export default function DashboardPage() {
  useDocumentTitle('Staff Dashboard');
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchDashboard() {
      try {
        const data = await getDashboard();
        if (active) {
          setDashboardData(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchDashboard();
    return () => {
      active = false;
    };
  }, [reloadKey, user]);

  const queueItems = dashboardData?.actionQueue || [];

  return (
    <StaffLayout>
      <div className="staff-dashboard">
        <header className="staff-dashboard__header">
          <div className="staff-dashboard__title-wrap">
            <h1>Staff Dashboard</h1>
            <p className="staff-dashboard__subtitle">
              Operational overview and actionable casework queue.
            </p>
          </div>
          <div className="staff-dashboard__role-badge">
            <span>{user?.role === 'admin' ? 'System-Wide Admin View' : `Assigned Queue: ${user?.name}`}</span>
          </div>
        </header>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
            <Spinner size={32} label="Loading dashboard data..." />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Could not load dashboard"
            description="An error occurred while fetching your operational queue."
            error={error}
            onRetry={loadData}
          />
        )}

        {!loading && !error && dashboardData && (
          <>
            {/* 1. "Needs My Action" Queue First */}
            <section className="action-queue-section" aria-labelledby="queue-heading">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FileTabHeading id="queue-heading" icon={<AlertTriangle size={16} />}>
                  Needs My Action
                </FileTabHeading>
                <span className="action-queue-badge" aria-label={`${queueItems.length} items needing action`}>
                  {queueItems.length}
                </span>
              </div>

              <div className="action-queue-card">
                <div className="action-queue-header">
                  <div className="action-queue-header__left">
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>
                      Active review items, pending responses and unassigned reports
                    </span>
                  </div>
                  <Link
                    to="/staff/reports"
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    All reports <ArrowRight size={12} />
                  </Link>
                </div>

                {queueItems.length === 0 ? (
                  <EmptyState
                    title="No pending actions"
                    description="You're all caught up! There are no reports awaiting review, pending matches, or unassigned records in your queue."
                    icon={<CheckCircle2 size={40} style={{ color: 'var(--success)' }} />}
                  />
                ) : (
                  <div className="action-queue-list" role="list">
                    {queueItems.map((item) => (
                      <div key={item.id} className="action-queue-row" role="listitem">
                        <span className={`action-queue-category action-queue-category--${item.category}`}>
                          {item.categoryLabel}
                        </span>

                        <div className="action-queue-info">
                          <span className="action-queue-title">{item.title}</span>
                          <div className="action-queue-meta">
                            <span className="action-queue-ref">{item.referenceNo}</span>
                            <span>•</span>
                            <span className="action-queue-date">{item.date}</span>
                          </div>
                        </div>

                        <div>
                          {item.priority && (
                            <StatusStamp kind="priority" status={item.priority} />
                          )}
                        </div>

                        <div>
                          {item.status && item.category !== 'pending_match' && (
                            <StatusStamp kind="report" status={item.status} />
                          )}
                          {item.category === 'pending_match' && (
                            <StatusStamp kind="match" status="pending" />
                          )}
                        </div>

                        <div className="action-queue-actions">
                          <Button
                            as={Link}
                            to={item.actionUrl}
                            size="sm"
                            variant="solid"
                          >
                            {item.actionLabel}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 2. Summary Stat Tiles */}
            <section className="stats-section" aria-label="Summary statistics">
              <FileTabHeading as="h2" icon={<FolderOpen size={16} />}>
                Casework Summary
              </FileTabHeading>

              <div className="stats-grid">
                <div className="stat-tile">
                  <div className="stat-tile__header">
                    <span className="stat-tile__label">Awaiting Review</span>
                    <span className="stat-tile__icon"><FileText size={16} /></span>
                  </div>
                  <span className="stat-tile__count">{dashboardData.awaitingReview}</span>
                </div>

                <div className="stat-tile">
                  <div className="stat-tile__header">
                    <span className="stat-tile__label">Info Needed</span>
                    <span className="stat-tile__icon"><FileQuestion size={16} /></span>
                  </div>
                  <span className="stat-tile__count">{dashboardData.infoRequested}</span>
                </div>

                <div className="stat-tile">
                  <div className="stat-tile__header">
                    <span className="stat-tile__label">Unassigned</span>
                    <span className="stat-tile__icon"><UserX size={16} /></span>
                  </div>
                  <span className="stat-tile__count">{dashboardData.unassigned}</span>
                </div>

                <div className="stat-tile">
                  <div className="stat-tile__header">
                    <span className="stat-tile__label">Pending Matches</span>
                    <span className="stat-tile__icon"><Sparkles size={16} /></span>
                  </div>
                  <span className="stat-tile__count">{dashboardData.pendingMatches}</span>
                </div>

                <div className="stat-tile">
                  <div className="stat-tile__header">
                    <span className="stat-tile__label">Active Cases</span>
                    <span className="stat-tile__icon"><Clock size={16} /></span>
                  </div>
                  <span className="stat-tile__count">{dashboardData.totalCases}</span>
                </div>

                <div className="stat-tile">
                  <div className="stat-tile__header">
                    <span className="stat-tile__label">Resolved Cases</span>
                    <span className="stat-tile__icon"><CheckCircle2 size={16} /></span>
                  </div>
                  <span className="stat-tile__count">{dashboardData.resolvedCases}</span>
                </div>
              </div>
            </section>

            {/* 3. Two Charts using Recharts (Colored ONLY via CSS variables) */}
            <section className="charts-section" aria-label="Analytical charts">
              <div className="charts-grid">
                {/* Chart 1: Cases by status */}
                <div className="chart-card">
                  <div className="chart-card__header">
                    <h3 className="chart-card__title">Cases by Status</h3>
                    <p className="chart-card__caption">Distribution of active and closed records</p>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={dashboardData.casesByStatus}
                        margin={{ top: 16, right: 16, left: -20, bottom: 4 }}
                      >
                        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="status"
                          stroke="var(--muted)"
                          tick={{ fill: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-sans)' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          stroke="var(--muted)"
                          tick={{ fill: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--surface)',
                            borderColor: 'var(--line)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--ink)',
                            boxShadow: '0 4px 12px var(--shadow-sm)',
                          }}
                          itemStyle={{ color: 'var(--ink)' }}
                          labelStyle={{ color: 'var(--muted)', fontWeight: 600 }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {dashboardData.casesByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Reports over time */}
                <div className="chart-card">
                  <div className="chart-card__header">
                    <h3 className="chart-card__title">Reports Over Time</h3>
                    <p className="chart-card__caption">Weekly report intake trend</p>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={dashboardData.reportsOverTime}
                        margin={{ top: 16, right: 16, left: -20, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="week"
                          stroke="var(--muted)"
                          tick={{ fill: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          stroke="var(--muted)"
                          tick={{ fill: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--surface)',
                            borderColor: 'var(--line)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--ink)',
                            boxShadow: '0 4px 12px var(--shadow-sm)',
                          }}
                          itemStyle={{ color: 'var(--accent)' }}
                          labelStyle={{ color: 'var(--muted)', fontWeight: 600 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#reportsGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </StaffLayout>
  );
}

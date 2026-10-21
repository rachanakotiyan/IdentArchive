/**
 * staffService – for officer and admin roles only.
 * Officers see only their assigned or unassigned items.
 * Admins see all.
 * NEVER import this from public components.
 */
import { MOCK_REPORTS } from '../mock/reports.js';
import { MOCK_CASES }   from '../mock/cases.js';
import { MOCK_MATCHES } from '../mock/matches.js';
import { MOCK_OFFICERS } from '../mock/officers.js';
import { MOCK_USERS }   from '../mock/users.js';
import { withLatency }  from '../mock/latency.js';
import apiClient from './apiClient.js';
import { getCurrentUser } from './authService.js';

function responseData(response) {
  return response?.data ?? response;
}

function reportView(report = {}) {
  return {
    reportId: report.report_id ?? report.reportId,
    referenceNo: report.reference_no ?? report.referenceNo,
    reportType: report.report_type ?? report.reportType,
    status: report.status,
    priority: report.priority ?? 'normal',
    description: report.description ?? '',
    dateReported: report.event_date ?? report.dateReported ?? report.created_at,
    createdDate: report.created_at ?? report.createdDate,
    person: {
      name: report.person_name ?? report.person?.name ?? null,
      age: report.age ?? report.person?.age ?? null,
      gender: report.gender ?? report.person?.gender ?? null,
    },
    location: {
      address: report.location_address ?? report.location?.address ?? null,
      pincode: report.location_pincode ?? report.location?.pincode ?? null,
      city: report.location_city ?? report.location?.city ?? null,
      district: report.location_district ?? report.location?.district ?? null,
      state: report.location_state ?? report.location?.state ?? null,
    },
    assignedOfficer: report.assigned_officer_id
      ? { officerId: report.assigned_officer_id, name: null }
      : report.assignedOfficer ?? null,
    caseId: report.case_id ?? report.caseId ?? null,
    reviewNote: report.review_note ?? report.reviewNote ?? null,
    history: report.history ?? [],
  };
}

function matchView(match = {}) {
  const verification = match.latest_verification ?? match.latestVerification;
  return {
    matchId: match.match_id ?? match.matchId,
    similarityScore: Number(match.similarity_score ?? match.similarityScore ?? 0),
    status: match.status,
    createdAt: match.created_at ?? match.createdAt,
    updatedAt: match.updated_at ?? match.updatedAt,
    missing: {
      caseId: match.missing_case_id ?? match.missing?.caseId,
      caseNumber: match.missing_case_number ?? match.missing?.caseNumber,
      title: match.missing_case_title ?? match.missing?.title,
      personName: match.missing_person_name ?? match.missing?.personName,
      age: match.missing_age ?? match.missing?.age,
      gender: match.missing_gender ?? match.missing?.gender,
      city: match.missing_city ?? match.missing?.city,
      district: match.missing_district ?? match.missing?.district,
      state: match.missing_state ?? match.missing?.state,
      date: match.missing_event_date ?? match.missing?.date,
    },
    found: {
      caseId: match.found_case_id ?? match.found?.caseId,
      caseNumber: match.found_case_number ?? match.found?.caseNumber,
      title: match.found_case_title ?? match.found?.title,
      personName: match.found_person_name ?? match.found?.personName,
      age: match.found_age ?? match.found?.age,
      gender: match.found_gender ?? match.found?.gender,
      city: match.found_city ?? match.found?.city,
      district: match.found_district ?? match.found?.district,
      state: match.found_state ?? match.found?.state,
      date: match.found_event_date ?? match.found?.date,
    },
    verifications: verification
      ? [{
          officerName: verification.officer_name ?? verification.officerName,
          officerBadge: verification.officer_badge ?? verification.officerBadge,
          decision: verification.decision,
          remarks: verification.remarks,
          verificationDate: verification.verification_date ?? verification.verificationDate,
        }]
      : match.verifications ?? [],
  };
}

async function getReportFromQueue(reportId) {
  const limit = 100;
  for (let page = 1; ; page += 1) {
    const response = await apiClient.get(`/staff/reports?page=${page}&limit=${limit}`);
    const reports = responseData(response);
    const report = (Array.isArray(reports) ? reports : []).find(
      (item) => String(item.report_id ?? item.reportId) === String(reportId),
    );
    if (report) return reportView(report);
    if (!Array.isArray(reports) || reports.length < limit) break;
  }
  throw new Error('Report not found or access denied.');
}

function assertStaff() {
  const user = getCurrentUser();
  if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
    throw new Error('Access denied.');
  }
  return user;
}

/** Filter reports visible to the current user */
function visibleReports(user) {
  if (user.role === 'admin') return MOCK_REPORTS;
  return MOCK_REPORTS.filter(
    r => r.assignedOfficer?.officerId === user.officerId || r.assignedOfficer === null
  );
}

/** Filter cases visible to the current user */
function visibleCases(user) {
  if (user.role === 'admin') return MOCK_CASES;
  // Officers see cases linked to their visible reports
  const reportCaseIds = visibleReports(user)
    .filter(r => r.caseId)
    .map(r => r.caseId);
  return MOCK_CASES.filter(c => reportCaseIds.includes(c.caseId));
}

export async function getDashboard() {
  return withLatency(() => {
    const user = assertStaff();
    const myReports = visibleReports(user);
    const myMatches = MOCK_MATCHES;

    const awaitingReviewItems = myReports
      .filter(r => r.status === 'submitted')
      .map(r => ({
        id: `rev-${r.reportId}`,
        reportId: r.reportId,
        category: 'awaiting_review',
        categoryLabel: 'Awaiting Review',
        title: r.person?.name
          ? `${r.reportType === 'missing' ? 'Missing' : 'Found'}: ${r.person.name}`
          : `${r.reportType === 'missing' ? 'Missing person' : 'Found person'} (${r.location.city})`,
        referenceNo: r.referenceNo,
        reportType: r.reportType,
        priority: r.priority,
        status: r.status,
        date: r.dateReported,
        actionUrl: `/staff/reports/${r.reportId}`,
        actionLabel: 'Review report',
      }));

    const infoRequestedItems = myReports
      .filter(r => r.status === 'info_requested')
      .map(r => ({
        id: `info-${r.reportId}`,
        reportId: r.reportId,
        category: 'info_requested',
        categoryLabel: 'Info Needed',
        title: r.person?.name ? `${r.person.name} – more info pending` : `Report ${r.referenceNo}`,
        referenceNo: r.referenceNo,
        reportType: r.reportType,
        priority: r.priority,
        status: r.status,
        date: r.dateReported,
        actionUrl: `/staff/reports/${r.reportId}`,
        actionLabel: 'Check note',
      }));

    const unassignedItems = myReports
      .filter(r => !r.assignedOfficer && r.status !== 'rejected' && r.status !== 'closed')
      .map(r => ({
        id: `unassign-${r.reportId}`,
        reportId: r.reportId,
        category: 'unassigned',
        categoryLabel: 'Unassigned',
        title: r.person?.name ? `${r.person.name}` : `Report ${r.referenceNo}`,
        referenceNo: r.referenceNo,
        reportType: r.reportType,
        priority: r.priority,
        status: r.status,
        date: r.dateReported,
        actionUrl: `/staff/reports/${r.reportId}`,
        actionLabel: 'Assign officer',
      }));

    const pendingMatchItems = myMatches
      .filter(m => m.status === 'pending')
      .map(m => ({
        id: `match-${m.matchId}`,
        matchId: m.matchId,
        category: 'pending_match',
        categoryLabel: 'Pending Match',
        title: `Match ${m.matchId}: ${m.missing?.personName || 'Record'} ↔ ${m.found?.caseNumber || 'Record'} (${Math.round(m.similarityScore * 100)}%)`,
        referenceNo: m.matchId,
        reportType: 'match',
        priority: m.similarityScore >= 0.9 ? 'urgent' : 'high',
        status: 'pending',
        date: m.missing?.date || 'Recent',
        actionUrl: `/staff/matches/${m.matchId}`,
        actionLabel: 'Review match',
      }));

    // Deduplicate reports in action queue
    const seenReportIds = new Set();
    const actionQueue = [];
    for (const item of awaitingReviewItems) {
      seenReportIds.add(item.reportId);
      actionQueue.push(item);
    }
    for (const item of infoRequestedItems) {
      if (!seenReportIds.has(item.reportId)) {
        seenReportIds.add(item.reportId);
        actionQueue.push(item);
      }
    }
    for (const item of unassignedItems) {
      if (!seenReportIds.has(item.reportId)) {
        seenReportIds.add(item.reportId);
        actionQueue.push(item);
      }
    }
    for (const item of pendingMatchItems) {
      actionQueue.push(item);
    }

    return {
      actionQueue,
      awaitingReview: awaitingReviewItems.length,
      infoRequested: infoRequestedItems.length,
      unassigned: unassignedItems.length,
      pendingMatches: pendingMatchItems.length,
      totalCases: visibleCases(user).length,
      resolvedCases: visibleCases(user).filter(c => c.caseStatus === 'resolved').length,
      casesByStatus: [
        { status: 'Open', count: MOCK_CASES.filter(c => c.caseStatus === 'open').length, color: 'var(--accent)' },
        { status: 'Under Review', count: MOCK_CASES.filter(c => c.caseStatus === 'under_review').length, color: 'var(--warning)' },
        { status: 'Resolved', count: MOCK_CASES.filter(c => c.caseStatus === 'resolved').length, color: 'var(--success)' },
        { status: 'Closed', count: MOCK_CASES.filter(c => c.caseStatus === 'closed').length, color: 'var(--muted)' },
      ],
      reportsOverTime: [
        { week: 'W37', count: 2 },
        { week: 'W38', count: 3 },
        { week: 'W39', count: 4 },
        { week: 'W40', count: 2 },
        { week: 'W41', count: 5 },
      ],
    };
  });
}

export async function listReports(filters = {}, page = 1, pageSize = 10) {
  const query = new URLSearchParams({ page: '1', limit: '100' });
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  const response = await apiClient.get(`/staff/reports?${query}`);
  let reports = (Array.isArray(responseData(response)) ? responseData(response) : []).map(reportView);

  if (filters.priority && filters.priority !== 'all') {
    reports = reports.filter((report) => report.priority === filters.priority);
  }
  if (filters.type && filters.type !== 'all') {
    reports = reports.filter((report) => report.reportType === filters.type);
  }
  if (filters.assignedOfficer && filters.assignedOfficer !== 'all') {
    reports = reports.filter((report) => filters.assignedOfficer === 'unassigned'
      ? !report.assignedOfficer
      : report.assignedOfficer?.officerId === filters.assignedOfficer);
  }
  if (filters.query) {
    const search = filters.query.toLowerCase().trim();
    reports = reports.filter((report) =>
      [report.referenceNo, report.person?.name, report.location?.city]
        .some((value) => value?.toLowerCase().includes(search)),
    );
  }

  const total = reports.length;
  const start = (page - 1) * pageSize;
  return { items: reports.slice(start, start + pageSize), total, page, pageSize };
}

export async function getReport(id) {
  return getReportFromQueue(id);
}

export async function decideReport(id, { action, note }) {
  let response;
  let status;
  let endpoint;
  let payload;
  if (action === 'approve') {
    endpoint = 'approve';
    payload = {};
    status = 'approved';
  } else if (action === 'reject') {
    endpoint = 'reject';
    payload = {
      rejection_reason: note,
    };
    status = 'rejected';
  } else if (action === 'requestInfo') {
    endpoint = 'info-request';
    payload = { note };
    status = 'info_requested';
  } else {
    throw new Error(`Unsupported report action: ${action}`);
  }

  const currentReport = await getReportFromQueue(id);
  response = await apiClient.post(
    `/staff/reports/${encodeURIComponent(id)}/${endpoint}`,
    payload,
  );
  const result = responseData(response) ?? {};
  const caseRecord = result.case ?? {};
  const updatedReport = result.report ?? (result.status ? result : null);
  return {
    ...currentReport,
    ...(updatedReport ? reportView(updatedReport) : {}),
    reportId: updatedReport?.report_id ?? updatedReport?.reportId ?? result.report_id ?? id,
    status: updatedReport?.status ?? status,
    caseId: caseRecord.case_id ?? caseRecord.caseId ?? currentReport.caseId,
    caseNumber: caseRecord.case_number ?? caseRecord.caseNumber ?? currentReport.caseNumber ?? null,
    reviewNote: note ?? currentReport.reviewNote,
  };
}

export async function assignOfficer(reportId, officerId) {
  return withLatency(() => {
    assertStaff();
    const r = MOCK_REPORTS.find(r => r.reportId === reportId);
    if (!r) throw new Error('Report not found.');
    const officer = MOCK_OFFICERS.find(o => o.officerId === officerId);
    if (!officer) throw new Error('Officer not found.');

    r.assignedOfficer = { officerId: officer.officerId, name: officer.name };
    r.history = r.history || [];
    r.history.push({
      date: new Date().toISOString(),
      event: `Assigned to ${officer.name}.`,
    });
    return r;
  });
}

export async function setPriority(reportId, priority) {
  return withLatency(() => {
    assertStaff();
    const r = MOCK_REPORTS.find(r => r.reportId === reportId);
    if (!r) throw new Error('Report not found.');

    r.priority = priority;
    r.history = r.history || [];
    r.history.push({
      date: new Date().toISOString(),
      event: `Priority updated to ${priority.toUpperCase()}.`,
    });
    return r;
  });
}

export async function listCases(filters = {}, page = 1, pageSize = 10) {
  return withLatency(() => {
    const user = assertStaff();
    let results = visibleCases(user);

    if (filters.caseStatus && filters.caseStatus !== 'all') {
      results = results.filter(c => c.caseStatus === filters.caseStatus);
    }
    if (filters.kind && filters.kind !== 'all') {
      results = results.filter(c => c.kind === filters.kind);
    }
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      results = results.filter(c =>
        c.caseNumber.toLowerCase().includes(q) ||
        (c.personName && c.personName.toLowerCase().includes(q)) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q))
      );
    }

    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);
    return { items, total, page, pageSize };
  });
}

export async function getCaseDetail(id) {
  return withLatency(() => {
    const user = assertStaff();
    const visible = visibleCases(user);
    const c = visible.find(c => c.caseId === id || c.caseNumber === id);
    if (!c) throw new Error('Case not found or access denied.');

    c.internalNotes = c.internalNotes || [
      { id: 'note-01', author: 'Inspector Rajan Verma', note: 'Case file reviewed and cross-referenced with regional registry.', date: '2026-09-21T10:00:00Z' }
    ];

    if (!c.assignedOfficer) {
      // Find officer from report or default
      const report = MOCK_REPORTS.find(r => r.caseId === c.caseId);
      c.assignedOfficer = report?.assignedOfficer || { officerId: 'off-001', name: 'Inspector Rajan Verma' };
    }

    // Attach matches linked to this case
    const matches = MOCK_MATCHES.filter(m =>
      m.missing?.caseId === c.caseId ||
      m.missing?.caseNumber === c.caseNumber ||
      m.found?.caseId === c.caseId ||
      m.found?.caseNumber === c.caseNumber
    );

    return { ...c, matches };
  });
}

export async function addCaseNote(id, note) {
  return withLatency(() => {
    const user = assertStaff();
    const c = MOCK_CASES.find(c => c.caseId === id || c.caseNumber === id);
    if (!c) throw new Error('Case not found.');
    c.internalNotes = c.internalNotes || [];
    const newNote = {
      id: `note-${Date.now()}`,
      author: user.name || 'Staff Officer',
      note,
      date: new Date().toISOString(),
    };
    c.internalNotes.unshift(newNote);
    return c;
  });
}

export async function assignCaseOfficer(caseId, officerId) {
  return withLatency(() => {
    const user = assertStaff();
    const c = MOCK_CASES.find(c => c.caseId === caseId || c.caseNumber === caseId);
    if (!c) throw new Error('Case not found.');
    const officer = MOCK_OFFICERS.find(o => o.officerId === officerId);
    if (!officer) throw new Error('Officer not found.');

    c.assignedOfficer = { officerId: officer.officerId, name: officer.name };
    c.updates = c.updates || [];
    c.updates.push({
      date: new Date().toISOString().slice(0, 10),
      note: `Assigned to ${officer.name} by ${user.name}.`,
    });
    return c;
  });
}

export async function closeCase(id, note) {
  return withLatency(() => {
    const user = assertStaff();
    const c = MOCK_CASES.find(c => c.caseId === id || c.caseNumber === id);
    if (!c) throw new Error('Case not found.');
    c.caseStatus = 'closed';
    c.updates = c.updates || [];
    c.updates.push({
      date: new Date().toISOString().slice(0, 10),
      note: `Case closed by ${user.name}. Reason: ${note}`,
    });
    return c;
  });
}

export async function listMatches(filters = {}, page = 1, pageSize = 10) {
  const query = new URLSearchParams({ page: '1', limit: '100' });
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  const response = await apiClient.get(`/staff/matches?${query}`);
  let matches = (Array.isArray(responseData(response)) ? responseData(response) : []).map(matchView);
  if (filters.query) {
    const search = filters.query.toLowerCase().trim();
    matches = matches.filter((match) =>
      [
        match.matchId,
        match.missing?.personName,
        match.missing?.caseNumber,
        match.found?.personName,
        match.found?.caseNumber,
        match.found?.city,
      ].some((value) => value?.toLowerCase().includes(search)),
    );
  }
  const total = matches.length;
  const start = (page - 1) * pageSize;
  return { items: matches.slice(start, start + pageSize), total, page, pageSize };
}

export async function getMatch(id) {
  const response = await apiClient.get(`/staff/matches/${encodeURIComponent(id)}`);
  return matchView(responseData(response));
}

export async function reviewMatch(id, { decision, remarks }) {
  const response = await apiClient.post(`/staff/matches/${encodeURIComponent(id)}/verify`, {
    action: decision,
    notes: remarks,
  });
  return matchView(responseData(response));
}

export async function listOfficers(filters = {}, page = 1, pageSize = 10) {
  return withLatency(() => {
    assertStaff();
    let results = [...MOCK_OFFICERS];
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      results = results.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.badge.toLowerCase().includes(q) ||
        o.district.toLowerCase().includes(q)
      );
    }
    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);
    return { items, total, page, pageSize };
  });
}

export async function listUsers(filters = {}, page = 1, pageSize = 10) {
  return withLatency(() => {
    const user = assertStaff();
    if (user.role !== 'admin') throw new Error('Admin access required.');
    let results = MOCK_USERS.map(({ password: _pw, ...safe }) => safe);
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      results = results.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        u.role.toLowerCase().includes(q)
      );
    }
    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);
    return { items, total, page, pageSize };
  });
}

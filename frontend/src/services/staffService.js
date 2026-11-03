/**
 * staffService – for officer and admin roles only.
 * Officers see only their assigned or unassigned items.
 * Admins see all.
 * NEVER import this from public components.
 */
import apiClient from './apiClient.js';

function responseData(response) {
  return response?.data ?? response;
}

function reportView(report = {}) {
  const assignedOfficer = report.assigned_officer_id || report.assigned_officer_name
    ? {
        officerId: report.assigned_officer_id ?? report.assignedOfficer?.officerId,
        name: report.assigned_officer_name ?? report.assignedOfficer?.name ?? null,
        badge: report.assigned_officer_badge ?? report.assignedOfficer?.badge ?? null,
      }
    : report.assignedOfficer ?? null;

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
    assignedOfficer,
    caseId: report.case_id ?? report.caseId ?? null,
    caseNumber: report.case_number ?? report.caseNumber ?? null,
    reviewNote: report.review_note ?? report.reviewNote ?? null,
    reporterName: report.reporter_name ?? report.reporterName ?? null,
    reporterPhone: report.reporter_phone ?? report.reporterPhone ?? null,
    reporterEmail: report.reporter_email ?? report.reporterEmail ?? null,
    history: (report.history ?? []).map((h) => ({
      id: h.id,
      event: h.event,
      actorId: h.actor_id ?? h.actorId,
      actorName: h.actor_name ?? h.actorName ?? 'System',
      date: h.created_at ?? h.date,
      createdAt: h.created_at ?? h.createdAt,
    })),
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
      : (match.verifications ?? []).map((v) => ({
          officerName: v.officer_name ?? v.officerName,
          officerBadge: v.officer_badge ?? v.officerBadge,
          decision: v.decision,
          remarks: v.remarks,
          verificationDate: v.verification_date ?? v.verificationDate,
        })),
  };
}

function staffCaseView(c = {}) {
  const assignedOfficer = c.assigned_officer_id || c.assigned_officer_name
    ? {
        officerId: c.assigned_officer_id ?? c.assignedOfficer?.officerId,
        name: c.assigned_officer_name ?? c.assignedOfficer?.name ?? null,
        badge: c.assigned_officer_badge ?? c.assignedOfficer?.badge ?? null,
        district: c.assigned_officer_district ?? c.assignedOfficer?.district ?? null,
      }
    : c.assignedOfficer ?? null;

  const updates = (c.updates ?? []).map((u) => ({
    id: u.id,
    caseId: u.case_id ?? u.caseId ?? c.case_id ?? c.caseId,
    date: u.update_date ?? u.date,
    updateDate: u.update_date ?? u.updateDate ?? u.date,
    note: u.note,
    createdAt: u.created_at ?? u.createdAt,
  }));

  const internalNotes = updates.map((u) => ({
    id: u.id,
    author: c.assigned_officer_name || 'Investigating Officer',
    note: u.note,
    date: u.date,
  }));

  return {
    caseId: c.case_id ?? c.caseId,
    caseNumber: c.case_number ?? c.caseNumber,
    title: c.title,
    crimeType: c.crime_type ?? c.crimeType,
    caseStatus: c.case_status ?? c.caseStatus,
    kind: c.kind,
    personName: c.person_name ?? c.personName ?? null,
    age: c.age ?? null,
    estimatedAge: c.estimated_age ?? c.estimatedAge ?? null,
    gender: c.gender,
    date: c.event_date ?? c.date ?? c.created_at,
    eventDate: c.event_date ?? c.eventDate,
    shortDescription: c.short_description ?? c.shortDescription,
    description: c.description,
    physicalFeatures: c.physical_features ?? c.physicalFeatures,
    identifyingMarks: c.identifying_marks ?? c.identifyingMarks,
    heightCm: c.height_cm ?? c.heightCm,
    city: c.city,
    district: c.district,
    state: c.state,
    reportId: c.report_id ?? c.reportId,
    reportReferenceNo: c.report_reference_no ?? c.reportReferenceNo,
    linkedReportRef: c.linked_report_ref ?? c.linkedReportRef ?? c.report_reference_no ?? c.reportReferenceNo ?? null,
    assignedOfficer,
    officer: assignedOfficer,
    updates,
    internalNotes,
    matches: (c.matches ?? []).map(matchView),
    history: c.history ?? [],
  };
}

function officerView(o = {}) {
  return {
    officerId: o.officer_id ?? o.officerId,
    userId: o.user_id ?? o.userId,
    name: o.name ?? o.full_name,
    fullName: o.full_name ?? o.name,
    email: o.email,
    badge: o.badge ?? o.badge_number,
    badgeNumber: o.badge_number ?? o.badge,
    district: o.district,
    active: o.active !== undefined ? Boolean(o.active) : true,
    workload: Number(o.workload ?? 0),
  };
}

function userView(u = {}) {
  return {
    userId: u.user_id ?? u.userId,
    name: u.name ?? u.full_name,
    fullName: u.full_name ?? u.name,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role,
    emailVerified: u.email_verified ?? u.emailVerified ?? false,
    createdAt: u.created_at ?? u.createdAt,
  };
}

export async function getDashboard() {
  const res = await apiClient.get('/staff/dashboard');
  const data = responseData(res) || {};

  const actionQueue = [];
  try {
    const [reportsRes, matchesRes] = await Promise.all([
      apiClient.get('/staff/reports?limit=50'),
      apiClient.get('/staff/matches?status=pending&limit=20'),
    ]);
    const queueReports = (Array.isArray(responseData(reportsRes)) ? responseData(reportsRes) : []).map(reportView);
    const queueMatches = (Array.isArray(responseData(matchesRes)) ? responseData(matchesRes) : []).map(matchView);

    const awaitingReviewItems = queueReports
      .filter((r) => r.status === 'submitted')
      .map((r) => ({
        id: `rev-${r.reportId}`,
        reportId: r.reportId,
        category: 'awaiting_review',
        categoryLabel: 'Awaiting Review',
        title: r.person?.name
          ? `${r.reportType === 'missing' ? 'Missing' : 'Found'}: ${r.person.name}`
          : `${r.reportType === 'missing' ? 'Missing person' : 'Found person'} (${r.location?.city || 'Unknown'})`,
        referenceNo: r.referenceNo,
        reportType: r.reportType,
        priority: r.priority,
        status: r.status,
        date: r.dateReported || r.createdDate,
        actionUrl: `/staff/reports/${r.reportId}`,
        actionLabel: 'Review report',
      }));

    const infoRequestedItems = queueReports
      .filter((r) => r.status === 'info_requested')
      .map((r) => ({
        id: `info-${r.reportId}`,
        reportId: r.reportId,
        category: 'info_requested',
        categoryLabel: 'Info Needed',
        title: r.person?.name ? `${r.person.name} – more info pending` : `Report ${r.referenceNo}`,
        referenceNo: r.referenceNo,
        reportType: r.reportType,
        priority: r.priority,
        status: r.status,
        date: r.dateReported || r.createdDate,
        actionUrl: `/staff/reports/${r.reportId}`,
        actionLabel: 'Check note',
      }));

    const unassignedItems = queueReports
      .filter((r) => !r.assignedOfficer && r.status !== 'rejected' && r.status !== 'closed')
      .map((r) => ({
        id: `unassign-${r.reportId}`,
        reportId: r.reportId,
        category: 'unassigned',
        categoryLabel: 'Unassigned',
        title: r.person?.name ? `${r.person.name}` : `Report ${r.referenceNo}`,
        referenceNo: r.referenceNo,
        reportType: r.reportType,
        priority: r.priority,
        status: r.status,
        date: r.dateReported || r.createdDate,
        actionUrl: `/staff/reports/${r.reportId}`,
        actionLabel: 'Assign officer',
      }));

    const pendingMatchItems = queueMatches
      .filter((m) => m.status === 'pending')
      .map((m) => ({
        id: `match-${m.matchId}`,
        matchId: m.matchId,
        category: 'pending_match',
        categoryLabel: 'Pending Match',
        title: `Match: ${m.missing?.personName || m.missing?.caseNumber || 'Record'} ↔ ${m.found?.caseNumber || 'Record'} (${Math.round((m.similarityScore || 0) * 100)}%)`,
        referenceNo: m.matchId,
        reportType: 'match',
        priority: (m.similarityScore || 0) >= 0.9 ? 'urgent' : 'high',
        status: 'pending',
        date: m.missing?.date || 'Recent',
        actionUrl: `/staff/matches/${m.matchId}`,
        actionLabel: 'Review match',
      }));

    const seen = new Set();
    for (const item of [...awaitingReviewItems, ...infoRequestedItems, ...unassignedItems, ...pendingMatchItems]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        actionQueue.push(item);
      }
    }
  } catch {
    // Gracefully handle queue fetch errors while keeping dashboard statistics
  }

  const casesStatus = data.casesByStatus || data.cases_by_status || {};
  const reportsStatus = data.reportsByStatus || data.reports_by_status || {};
  const activeCases = Number(
    data.activeCases
      ?? data.active_cases
      ?? ((Number(casesStatus.open ?? 0)) + (Number(casesStatus.under_review ?? 0))),
  );
  const pendingMatches = Number(data.pendingMatches ?? data.pending_matches ?? 0);
  const awaitingReview = Number(data.awaitingReview ?? data.awaiting_review ?? reportsStatus.submitted ?? 0);
  const totalCases = Number(data.totalCases ?? data.total_cases ?? 0);

  return {
    actionQueue,
    kpis: {
      activeCases,
      pendingMatches,
      awaitingReview,
      totalCases,
    },
    awaitingReview,
    infoRequested: Number(data.infoRequested ?? data.info_requested ?? reportsStatus.info_requested ?? 0),
    unassigned: Number(data.unassigned ?? 0),
    pendingMatches,
    totalCases,
    resolvedCases: Number(data.resolvedCases ?? data.resolved_cases ?? casesStatus.resolved ?? 0),
    casesByStatus: data.casesByStatusList ?? [
      { status: 'Open', count: Number(casesStatus.open ?? 0), color: 'var(--accent)' },
      { status: 'Under Review', count: Number(casesStatus.under_review ?? 0), color: 'var(--warning)' },
      { status: 'Resolved', count: Number(casesStatus.resolved ?? 0), color: 'var(--success)' },
      { status: 'Closed', count: Number(casesStatus.closed ?? 0), color: 'var(--muted)' },
    ],
    reportsOverTime: data.reportsOverTime ?? data.reportsPerWeek ?? data.reports_per_week ?? [],
    myItems: data.myItems ?? data.my_items,
    recentActivity: data.recentActivity ?? data.recent_activity ?? [],
  };
}

export async function listReports(filters = {}, page = 1, pageSize = 10) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });

  if (filters.status && filters.status !== 'all') {
    query.set('status', filters.status);
  }
  if (filters.priority && filters.priority !== 'all') {
    query.set('priority', filters.priority);
  }
  const reportType = filters.type || filters.reportType;
  if (reportType && reportType !== 'all') {
    query.set('report_type', reportType);
  }
  if (filters.assignedOfficer && filters.assignedOfficer !== 'all') {
    query.set('assigned', filters.assignedOfficer);
  } else if (filters.assigned && filters.assigned !== 'all') {
    query.set('assigned', filters.assigned);
  }
  const searchText = filters.query || filters.q;
  if (searchText) {
    query.set('q', String(searchText).trim());
  }

  const response = await apiClient.get(`/staff/reports?${query.toString()}`);
  const records = responseData(response);
  const meta = response?.meta ?? {};
  const items = (Array.isArray(records) ? records : []).map(reportView);
  const total = Number(meta.total ?? items.length);

  return { items, total, page, pageSize };
}

export async function getReport(id) {
  const response = await apiClient.get(`/staff/reports/${encodeURIComponent(id)}`);
  return reportView(responseData(response));
}

export async function decideReport(id, { action, note, caseData = {} }) {
  let endpoint;
  let payload;
  let fallbackStatus;

  if (action === 'approve') {
    endpoint = 'approve';
    payload = caseData;
    fallbackStatus = 'approved';
  } else if (action === 'reject') {
    endpoint = 'reject';
    payload = {
      rejection_reason: note,
    };
    fallbackStatus = 'rejected';
  } else if (action === 'requestInfo') {
    endpoint = 'info-request';
    payload = { note };
    fallbackStatus = 'info_requested';
  } else {
    throw new Error(`Unsupported report action: ${action}`);
  }

  const response = await apiClient.post(
    `/staff/reports/${encodeURIComponent(id)}/${endpoint}`,
    payload,
  );
  const result = responseData(response) ?? {};
  const caseRecord = result.case ?? {};
  const updatedReport = result.report ?? (result.status ? result : null);

  return {
    ...(updatedReport ? reportView(updatedReport) : {}),
    reportId: updatedReport?.report_id ?? updatedReport?.reportId ?? result.report_id ?? id,
    status: updatedReport?.status ?? result.status ?? fallbackStatus,
    caseId: caseRecord.case_id ?? caseRecord.caseId ?? null,
    caseNumber: caseRecord.case_number ?? caseRecord.caseNumber ?? null,
    reviewNote: note ?? updatedReport?.review_note ?? null,
  };
}

export async function assignOfficer(reportId, officerId) {
  const response = await apiClient.post(`/staff/reports/${encodeURIComponent(reportId)}/assign`, {
    officer_id: officerId,
  });
  return reportView(responseData(response));
}

export async function setPriority(reportId, priority) {
  const response = await apiClient.patch(`/staff/reports/${encodeURIComponent(reportId)}/priority`, {
    priority,
  });
  return reportView(responseData(response));
}

export async function listCases(filters = {}, page = 1, pageSize = 10) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });

  const caseStatus = filters.caseStatus || filters.status;
  if (caseStatus && caseStatus !== 'all') {
    query.set('case_status', caseStatus);
  }
  const kind = filters.kind || filters.caseType;
  if (kind && kind !== 'all') {
    query.set('kind', kind);
  }
  const searchText = filters.query || filters.q;
  if (searchText) {
    query.set('q', String(searchText).trim());
  }

  const response = await apiClient.get(`/staff/cases?${query.toString()}`);
  const records = responseData(response);
  const meta = response?.meta ?? {};
  const items = (Array.isArray(records) ? records : []).map(staffCaseView);
  const total = Number(meta.total ?? items.length);

  return { items, total, page, pageSize };
}

export async function getCaseDetail(id) {
  const response = await apiClient.get(`/staff/cases/${encodeURIComponent(id)}`);
  return staffCaseView(responseData(response));
}

export async function addCaseNote(caseId, note) {
  await apiClient.post(`/staff/cases/${encodeURIComponent(caseId)}/updates`, {
    note: String(note).slice(0, 255),
  });
  return getCaseDetail(caseId);
}

export async function assignCaseOfficer(caseId, officerId) {
  await apiClient.post(`/staff/cases/${encodeURIComponent(caseId)}/assign`, {
    officer_id: officerId,
  });
  return getCaseDetail(caseId);
}

export async function updateCaseStatus(caseId, status) {
  await apiClient.patch(`/staff/cases/${encodeURIComponent(caseId)}/status`, {
    status,
  });
  return getCaseDetail(caseId);
}

export async function closeCase(caseId, note) {
  await apiClient.post(`/staff/cases/${encodeURIComponent(caseId)}/close`, {
    note,
  });
  return getCaseDetail(caseId);
}

export async function listMatches(filters = {}, page = 1, pageSize = 10) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });

  if (filters.status && filters.status !== 'all') {
    query.set('status', filters.status);
  }

  const response = await apiClient.get(`/staff/matches?${query.toString()}`);
  const records = responseData(response);
  const meta = response?.meta ?? {};
  let items = (Array.isArray(records) ? records : []).map(matchView);

  if (filters.query) {
    const search = filters.query.toLowerCase().trim();
    items = items.filter((match) =>
      [
        match.matchId,
        match.missing?.personName,
        match.missing?.caseNumber,
        match.found?.personName,
        match.found?.caseNumber,
        match.found?.city,
      ].some((val) => val?.toLowerCase().includes(search)),
    );
  }

  const total = Number(meta.total ?? items.length);
  return { items, total, page, pageSize };
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
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  const search = filters.query || filters.q;
  if (search) {
    query.set('q', String(search).trim());
  }

  const response = await apiClient.get(`/admin/officers?${query.toString()}`);
  const records = responseData(response);
  const meta = response?.meta ?? {};
  const items = (Array.isArray(records) ? records : []).map(officerView);
  const total = Number(meta.total ?? items.length);

  return { items, total, page, pageSize };
}

export async function listUsers(filters = {}, page = 1, pageSize = 10) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  const search = filters.query || filters.q;
  if (search) {
    query.set('q', String(search).trim());
  }
  if (filters.role && filters.role !== 'all') {
    query.set('role', filters.role);
  }

  const response = await apiClient.get(`/admin/users?${query.toString()}`);
  const records = responseData(response);
  const meta = response?.meta ?? {};
  const items = (Array.isArray(records) ? records : []).map(userView);
  const total = Number(meta.total ?? items.length);

  return { items, total, page, pageSize };
}

// Aliases matching requirements and controllers
export const getStaffReports = listReports;
export const getStaffReportById = getReport;
export const getStaffCases = listCases;
export const getStaffCaseById = getCaseDetail;
export const addCaseUpdate = addCaseNote;
export const assignCase = assignCaseOfficer;
export const getStaffMatches = listMatches;
export const getStaffMatchById = getMatch;
export const verifyMatch = (id, { action, notes }) => reviewMatch(id, { decision: action, remarks: notes });
export const getOfficers = listOfficers;
export const getUsers = listUsers;

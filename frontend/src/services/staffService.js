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
import { getCurrentUser } from './authService.js';

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
  return withLatency(() => {
    const user = assertStaff();
    let results = visibleReports(user);

    if (filters.status && filters.status !== 'all') {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      results = results.filter(r => r.priority === filters.priority);
    }
    if (filters.type && filters.type !== 'all') {
      results = results.filter(r => r.reportType === filters.type);
    }
    if (filters.assignedOfficer && filters.assignedOfficer !== 'all') {
      if (filters.assignedOfficer === 'unassigned') {
        results = results.filter(r => !r.assignedOfficer);
      } else {
        results = results.filter(r => r.assignedOfficer?.officerId === filters.assignedOfficer);
      }
    }
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      results = results.filter(r =>
        r.referenceNo.toLowerCase().includes(q) ||
        (r.person?.name && r.person.name.toLowerCase().includes(q)) ||
        (r.location?.city && r.location.city.toLowerCase().includes(q))
      );
    }

    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);
    return { items, total, page, pageSize };
  });
}

export async function getReport(id) {
  return withLatency(() => {
    const user = assertStaff();
    const visible = visibleReports(user);
    const r = visible.find(r => r.reportId === id);
    if (!r) throw new Error('Report not found or access denied.');

    // Ensure linked case number is visible if case exists
    const linkedCase = r.caseId ? MOCK_CASES.find(c => c.caseId === r.caseId) : null;
    return {
      ...r,
      caseNumber: linkedCase?.caseNumber || r.caseNumber || null,
    };
  });
}

export async function decideReport(id, { action, note }) {
  return withLatency(() => {
    assertStaff();
    const r = MOCK_REPORTS.find(r => r.reportId === id);
    if (!r) throw new Error('Report not found.');

    r.history = r.history || [];

    if (action === 'approve') {
      r.status = 'approved';
      if (note) r.reviewNote = note;

      // Ensure a public case exists in MOCK_CASES
      let existingCase = r.caseId ? MOCK_CASES.find(c => c.caseId === r.caseId) : null;
      if (existingCase) {
        existingCase.caseStatus = 'open';
        r.caseNumber = existingCase.caseNumber;
      } else {
        const nextNum = MOCK_CASES.length + 1;
        const caseNumber = `IA-2026-${String(nextNum).padStart(4, '0')}`;
        const caseId = `case-${String(nextNum).padStart(3, '0')}`;
        const newCase = {
          caseId,
          caseNumber,
          title: `${r.reportType === 'missing' ? 'Missing person' : 'Unidentified person'} — ${r.person?.name || r.location?.city || 'Record'}`,
          crimeType: r.reportType === 'missing' ? 'missing_person' : 'unidentified_person',
          caseStatus: 'open',
          kind: r.reportType,
          personName: r.person?.name || null,
          age: r.person?.age ?? null,
          estimatedAge: r.person?.estimatedAge ?? null,
          gender: r.person?.gender || 'unknown',
          date: r.person?.date || r.dateReported,
          shortDescription: r.description ? (r.description.length > 100 ? `${r.description.slice(0, 97)}...` : r.description) : '',
          city: r.location?.city || '',
          district: r.location?.district || '',
          state: r.location?.state || '',
          description: r.description || '',
          physicalFeatures: r.person?.physicalFeatures || '',
          identifyingMarks: r.person?.identifyingMarks || '',
          heightCm: r.person?.heightCm || null,
          updates: [
            { date: new Date().toISOString().slice(0, 10), note: `Case opened upon approval of report ${r.referenceNo}.` }
          ]
        };
        MOCK_CASES.unshift(newCase);
        r.caseId = caseId;
        r.caseNumber = caseNumber;
      }

      r.history.push({
        date: new Date().toISOString(),
        event: `Report approved. Case ${r.caseNumber} created.`,
      });
      return r;
    }

    if (action === 'reject') {
      r.status = 'rejected';
      r.reviewNote = note;
      // If any case was linked, remove or ensure it is not open
      if (r.caseId) {
        const linkedCase = MOCK_CASES.find(c => c.caseId === r.caseId);
        if (linkedCase) {
          linkedCase.caseStatus = 'closed';
        }
      }
      r.history.push({
        date: new Date().toISOString(),
        event: `Report rejected. Reason: ${note}`,
      });
      return r;
    }

    if (action === 'requestInfo') {
      r.status = 'info_requested';
      r.reviewNote = note;
      r.history.push({
        date: new Date().toISOString(),
        event: `Information requested from reporter: "${note}"`,
      });
      return r;
    }

    return r;
  });
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

    if (filters.caseStatus) results = results.filter(c => c.caseStatus === filters.caseStatus);
    if (filters.kind)       results = results.filter(c => c.kind === filters.kind);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(c =>
        c.caseNumber.toLowerCase().includes(q) ||
        (c.personName && c.personName.toLowerCase().includes(q))
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
    const c = visible.find(c => c.caseId === id);
    if (!c) throw new Error('Case not found or access denied.');
    return c;
  });
}

export async function closeCase(id, note) {
  return withLatency(() => {
    assertStaff();
    const c = MOCK_CASES.find(c => c.caseId === id);
    if (!c) throw new Error('Case not found.');
    c.caseStatus = 'closed';
    if (note) c.updates.push({ date: new Date().toISOString().slice(0, 10), note });
    return c;
  });
}

export async function listMatches(filters = {}) {
  return withLatency(() => {
    assertStaff();
    let results = [...MOCK_MATCHES];
    if (filters.status) results = results.filter(m => m.status === filters.status);
    return { items: results, total: results.length };
  });
}

export async function getMatch(id) {
  return withLatency(() => {
    assertStaff();
    const m = MOCK_MATCHES.find(m => m.matchId === id);
    if (!m) throw new Error('Match not found.');
    return m;
  });
}

export async function reviewMatch(id, { decision, remarks }) {
  return withLatency(() => {
    assertStaff();
    const user = getCurrentUser();
    const m = MOCK_MATCHES.find(m => m.matchId === id);
    if (!m) throw new Error('Match not found.');
    m.status = decision; // 'confirmed' or 'dismissed'
    m.verifications.push({
      officerName: user.name,
      decision,
      remarks,
      verificationDate: new Date().toISOString(),
    });
    return m;
  });
}

export async function listOfficers() {
  return withLatency(() => {
    assertStaff();
    return MOCK_OFFICERS;
  });
}

export async function listUsers() {
  return withLatency(() => {
    const user = assertStaff();
    if (user.role !== 'admin') throw new Error('Admin access required.');
    return MOCK_USERS.map(({ password: _pw, ...safe }) => safe);
  });
}

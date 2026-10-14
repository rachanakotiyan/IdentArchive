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

    return {
      awaitingReview:     myReports.filter(r => r.status === 'submitted').length,
      infoRequested:      myReports.filter(r => r.status === 'info_requested').length,
      unassigned:         myReports.filter(r => !r.assignedOfficer).length,
      pendingMatches:     myMatches.filter(m => m.status === 'pending').length,
      totalCases:         visibleCases(user).length,
      resolvedCases:      visibleCases(user).filter(c => c.caseStatus === 'resolved').length,
      casesByStatus:      {
        open:         MOCK_CASES.filter(c => c.caseStatus === 'open').length,
        under_review: MOCK_CASES.filter(c => c.caseStatus === 'under_review').length,
        resolved:     MOCK_CASES.filter(c => c.caseStatus === 'resolved').length,
        closed:       MOCK_CASES.filter(c => c.caseStatus === 'closed').length,
      },
      reportsOverTime: [
        { week: '2026-W37', count: 2 },
        { week: '2026-W38', count: 3 },
        { week: '2026-W39', count: 4 },
        { week: '2026-W40', count: 1 },
      ],
    };
  });
}

export async function listReports(filters = {}, page = 1, pageSize = 10) {
  return withLatency(() => {
    const user = assertStaff();
    let results = visibleReports(user);

    if (filters.status)   results = results.filter(r => r.status === filters.status);
    if (filters.priority) results = results.filter(r => r.priority === filters.priority);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(r =>
        r.referenceNo.toLowerCase().includes(q) ||
        (r.person.name && r.person.name.toLowerCase().includes(q))
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
    return r;
  });
}

export async function decideReport(id, { action, note }) {
  return withLatency(() => {
    assertStaff();
    const r = MOCK_REPORTS.find(r => r.reportId === id);
    if (!r) throw new Error('Report not found.');
    const actionMap = { approve: 'approved', reject: 'rejected', requestInfo: 'info_requested' };
    r.status = actionMap[action] ?? r.status;
    r.reviewNote = note ?? r.reviewNote;
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
    return r;
  });
}

export async function setPriority(reportId, priority) {
  return withLatency(() => {
    assertStaff();
    const r = MOCK_REPORTS.find(r => r.reportId === reportId);
    if (!r) throw new Error('Report not found.');
    r.priority = priority;
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

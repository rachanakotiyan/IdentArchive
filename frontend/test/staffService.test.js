import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/services/apiClient.js';
import {
  decideReport,
  listMatches,
  listReports,
  getMatch,
  reviewMatch,
  getDashboard,
  listCases,
  getCaseDetail,
  addCaseNote,
  closeCase,
  listOfficers,
  listUsers,
} from '../src/services/staffService.js';

function mockFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => handler(...args);
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(data, options = {}) {
  const { status = 200, meta } = options;
  return new Response(JSON.stringify({ success: status < 400, data, meta }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('staff report queue maps API reports and sends supported queue filters', async () => {
  let requestUrl;
  const restore = mockFetch(async (url) => {
    requestUrl = url;
    return jsonResponse([{
      report_id: 'report-1',
      reference_no: 'REF-001',
      report_type: 'missing',
      status: 'submitted',
      person_name: 'Test Person',
      location_city: 'Bengaluru',
      event_date: '2026-10-20',
      assigned_officer_id: 'officer-1',
    }]);
  });

  try {
    const result = await listReports({ status: 'submitted' }, 1, 10);
    assert.match(requestUrl, /\/api\/staff\/reports\?page=1&limit=10&status=submitted$/);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].reportId, 'report-1');
    assert.equal(result.items[0].person.name, 'Test Person');
    assert.equal(result.items[0].location.city, 'Bengaluru');
    assert.equal(result.items[0].assignedOfficer.officerId, 'officer-1');
  } finally {
    restore();
  }
});

test('staff report approval posts to the action route and maps the created case', async () => {
  const calls = [];
  const restore = mockFetch(async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({
      report_id: 'report-2',
      status: 'approved',
      case: { case_id: 'case-2', case_number: 'IA-2026-0002' },
      report: {
        report_id: 'report-2',
        status: 'approved',
        person_name: 'Unknown Person',
      },
    });
  });

  try {
    const report = await decideReport('report-2', { action: 'approve' });
    assert.equal(calls[0].url, 'http://localhost:3000/api/staff/reports/report-2/approve');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), {});
    assert.equal(report.status, 'approved');
    assert.equal(report.caseId, 'case-2');
    assert.equal(report.caseNumber, 'IA-2026-0002');
    assert.equal(report.person.name, 'Unknown Person');
  } finally {
    restore();
  }
});

test('staff match queue and detail map backend fields; verification uses backend payload names', async () => {
  const calls = [];
  const row = {
    match_id: 'match-1',
    missing_case_id: 'missing-id',
    missing_case_number: 'IA-M-1',
    missing_person_name: 'Missing Person',
    found_case_id: 'found-id',
    found_case_number: 'IA-F-1',
    found_city: 'Bengaluru',
    similarity_score: '0.92',
    status: 'pending',
  };
  const restore = mockFetch(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/verify')) {
      return jsonResponse({ ...row, status: 'confirmed' });
    }
    if (url.includes('/match-1')) {
      return jsonResponse({ ...row, latest_verification: {
        officer_name: 'Officer Name',
        decision: 'confirmed',
        remarks: 'Identity confirmed',
      } });
    }
    return jsonResponse([row], { meta: { page: 1, limit: 10, count: 1 } });
  });

  try {
    const queue = await listMatches({ status: 'pending', query: 'Missing Person' }, 1, 10);
    assert.equal(calls[0].url, 'http://localhost:3000/api/staff/matches?page=1&limit=10&status=pending');
    assert.equal(queue.items[0].matchId, 'match-1');
    assert.equal(queue.items[0].similarityScore, 0.92);
    assert.equal(queue.items[0].missing.caseNumber, 'IA-M-1');
    assert.equal(queue.items[0].found.caseNumber, 'IA-F-1');

    const detail = await getMatch('match-1');
    assert.equal(detail.verifications[0].officerName, 'Officer Name');

    const updated = await reviewMatch('match-1', {
      decision: 'confirmed',
      remarks: 'Identity confirmed',
    });
    assert.equal(calls[2].url, 'http://localhost:3000/api/staff/matches/match-1/verify');
    assert.equal(calls[2].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[2].options.body), {
      action: 'confirmed',
      notes: 'Identity confirmed',
    });
    assert.equal(updated.status, 'confirmed');
  } finally {
    restore();
  }
});

test('staff service surfaces backend errors without replacing their message or status', async () => {
  const restore = mockFetch(async () => new Response(JSON.stringify({
    success: false,
    error: { code: 'CONFLICT', message: 'Match has already been decided.' },
  }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  }));

  try {
    await assert.rejects(
      reviewMatch('match-1', { decision: 'confirmed', remarks: 'Reviewed.' }),
      (error) => error instanceof ApiError
        && error.status === 409
        && error.code === 'CONFLICT'
        && error.message === 'Match has already been decided.',
    );
  } finally {
    restore();
  }
});

test('staff dashboard aggregates counts, recent activity, and action queue items', async () => {
  const restore = mockFetch(async (url) => {
    if (url.includes('/staff/dashboard')) {
      return jsonResponse({
        reports_by_status: { submitted: 4, under_review: 2 },
        cases_by_status: { open: 10, under_review: 3, resolved: 7 },
        pending_matches: 5,
        reports_per_week: [{ week: 'W1', count: 12 }],
        recent_activity: [{ action: 'Report approved', created_at: '2026-10-21T00:00:00Z' }],
      });
    }
    if (url.includes('/staff/reports')) {
      return jsonResponse([{
        report_id: 'rep-1',
        reference_no: 'REF-111',
        report_type: 'missing',
        status: 'submitted',
        person_name: 'Awaiting Person',
      }]);
    }
    if (url.includes('/staff/matches')) {
      return jsonResponse([{
        match_id: 'm-1',
        similarity_score: '0.88',
        missing_person_name: 'Person A',
        found_city: 'City B',
        status: 'pending',
        created_at: '2026-10-20T00:00:00Z',
      }]);
    }
    return jsonResponse({});
  });

  try {
    const dashboard = await getDashboard();
    assert.equal(dashboard.kpis.activeCases, 13);
    assert.equal(dashboard.kpis.pendingMatches, 5);
    assert.equal(dashboard.casesByStatus[0].status, 'Open');
    assert.equal(dashboard.casesByStatus[0].count, 10);
    assert.ok(Array.isArray(dashboard.actionQueue));
    assert.equal(dashboard.actionQueue.length, 3);
    assert.equal(dashboard.actionQueue[0].category, 'awaiting_review');
    assert.equal(dashboard.actionQueue[1].category, 'unassigned');
    assert.equal(dashboard.actionQueue[2].category, 'pending_match');
  } finally {
    restore();
  }
});

test('staff cases: list, detail, add note, and close map database fields to camelCase', async () => {
  const calls = [];
  const sampleCase = {
    case_id: 'case-100',
    case_number: 'IA-2026-0100',
    case_status: 'open',
    kind: 'missing',
    crime_type: 'missing_person',
    title: 'Missing Person - John',
    short_description: 'Case summary',
    person_name: 'John Doe',
    age: 30,
    gender: 'male',
    assigned_officer_name: 'Officer Smith',
    assigned_officer_badge: 'BADGE123',
    linked_report_ref: 'REF-001',
    updates: [{ note: 'First note', update_date: '2026-10-20' }],
    matches: [],
    history: [],
  };

  const restore = mockFetch(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/staff/cases/case-100/updates')) {
      return jsonResponse({ success: true });
    }
    if (url.includes('/staff/cases/case-100/close')) {
      return jsonResponse({ success: true });
    }
    if (url.includes('/staff/cases/case-100')) {
      return jsonResponse(sampleCase);
    }
    return jsonResponse([sampleCase], { meta: { total: 1 } });
  });

  try {
    const list = await listCases({ status: 'open', kind: 'missing' }, 1, 10);
    assert.equal(list.total, 1);
    assert.equal(list.items[0].caseId, 'case-100');
    assert.equal(list.items[0].caseNumber, 'IA-2026-0100');
    assert.equal(list.items[0].assignedOfficer.name, 'Officer Smith');
    assert.equal(list.items[0].assignedOfficer.badge, 'BADGE123');

    const detail = await getCaseDetail('case-100');
    assert.equal(detail.caseId, 'case-100');
    assert.equal(detail.linkedReportRef, 'REF-001');
    assert.equal(detail.updates[0].note, 'First note');

    await addCaseNote('case-100', 'New search update');
    const updateCall = calls.find((c) => c.url.includes('/updates'));
    assert.equal(updateCall.options.method, 'POST');
    assert.deepEqual(JSON.parse(updateCall.options.body), { note: 'New search update' });

    await closeCase('case-100', 'Case resolved successfully');
    const closeCall = calls.find((c) => c.url.includes('/close'));
    assert.equal(closeCall.options.method, 'POST');
    assert.deepEqual(JSON.parse(closeCall.options.body), { note: 'Case resolved successfully' });
  } finally {
    restore();
  }
});

test('admin services: listOfficers and listUsers query admin routes and map camelCase view models', async () => {
  const calls = [];
  const restore = mockFetch(async (url) => {
    calls.push(url);
    if (url.includes('/admin/officers')) {
      return jsonResponse([{
        officer_id: 'off-1',
        user_id: 'usr-1',
        full_name: 'Officer Badge 1',
        badge_number: 'B-001',
        email: 'officer@example.com',
        district: 'Bengaluru',
        active: true,
        workload: 3,
      }], { meta: { total: 1 } });
    }
    if (url.includes('/admin/users')) {
      return jsonResponse([{
        user_id: 'usr-2',
        full_name: 'Individual User',
        email: 'user@example.com',
        role: 'individual',
        email_verified: true,
        created_at: '2026-01-01T00:00:00Z',
      }], { meta: { total: 1 } });
    }
    return jsonResponse([]);
  });

  try {
    const officers = await listOfficers({ q: 'Badge' }, 1, 10);
    assert.equal(officers.total, 1);
    assert.equal(officers.items[0].officerId, 'off-1');
    assert.equal(officers.items[0].badgeNumber, 'B-001');
    assert.equal(officers.items[0].workload, 3);
    assert.match(calls[0], /\/admin\/officers\?page=1&limit=10&q=Badge/);

    const users = await listUsers({ role: 'individual' }, 1, 10);
    assert.equal(users.total, 1);
    assert.equal(users.items[0].userId, 'usr-2');
    assert.equal(users.items[0].emailVerified, true);
    assert.match(calls[1], /\/admin\/users\?page=1&limit=10&role=individual/);
  } finally {
    restore();
  }
});

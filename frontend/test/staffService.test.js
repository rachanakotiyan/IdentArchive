import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/services/apiClient.js';
import {
  decideReport,
  listMatches,
  listReports,
  getMatch,
  reviewMatch,
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
    assert.match(requestUrl, /\/api\/staff\/reports\?page=1&limit=100&status=submitted$/);
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
    if (url.endsWith('/staff/reports?page=1&limit=100')) {
      return jsonResponse([{
        report_id: 'report-2',
        reference_no: 'REF-002',
        report_type: 'found',
        status: 'under_review',
        person_name: 'Unknown Person',
      }]);
    }
    return jsonResponse({
      report_id: 'report-2',
      case: { case_id: 'case-2', case_number: 'IA-2026-0002' },
    });
  });

  try {
    const report = await decideReport('report-2', { action: 'approve' });
    assert.equal(calls[0].url, 'http://localhost:3000/api/staff/reports?page=1&limit=100');
    assert.equal(calls[1].url, 'http://localhost:3000/api/staff/reports/report-2/approve');
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].options.body), {});
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
    return jsonResponse([row], { meta: { page: 1, limit: 100, count: 1 } });
  });

  try {
    const queue = await listMatches({ status: 'pending', query: 'Missing Person' }, 1, 10);
    assert.equal(calls[0].url, 'http://localhost:3000/api/staff/matches?page=1&limit=100&status=pending');
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

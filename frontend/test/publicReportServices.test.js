import test from 'node:test';
import assert from 'node:assert/strict';
import * as publicService from '../src/services/publicService.js';
import * as reportService from '../src/services/reportService.js';

function mockFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => handler(...args);
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(data, meta) {
  return new Response(JSON.stringify({ success: true, data, meta }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('public case services call the live API and map database fields', async () => {
  const calls = [];
  const restore = mockFetch(async (url) => {
    calls.push(url);
    if (url.includes('/updates')) {
      return jsonResponse([{ update_date: '2026-02-01', note: 'Search started.' }]);
    }
    if (url.includes('/api/cases/')) {
      return jsonResponse({
        case_id: 'case-id',
        case_number: 'IA-2026-0001',
        case_status: 'open',
        crime_type: 'missing_person',
        kind: 'missing',
        event_date: '2026-01-31',
        person_name: 'Test Person',
      });
    }
    return jsonResponse([{
      case_id: 'case-id',
      case_number: 'IA-2026-0001',
      case_status: 'open',
      crime_type: 'missing_person',
      kind: 'missing',
      event_date: '2026-01-31',
      person_name: 'Test Person',
    }], { total: 1, page: 2, limit: 12 });
  });

  try {
    const cases = await publicService.getCases({ kind: 'missing', page: 2, pageSize: 12 });
    assert.equal(cases.items[0].caseId, 'case-id');
    assert.equal(cases.items[0].caseNumber, 'IA-2026-0001');
    assert.equal(cases.total, 1);
    assert.equal(cases.page, 2);
    assert.match(calls[0], /\/api\/cases\?case_type=missing&page=2&limit=12$/);

    const detail = await publicService.getCaseByNumber('IA-2026-0001');
    assert.equal(detail.personName, 'Test Person');
    assert.match(calls[1], /\/api\/cases\/IA-2026-0001$/);

    const updates = await publicService.getCaseUpdates('IA-2026-0001');
    assert.deepEqual(updates, [{ date: '2026-02-01', note: 'Search started.' }]);
    assert.match(calls[2], /\/api\/cases\/IA-2026-0001\/updates$/);
  } finally {
    restore();
  }
});

test('report services submit, list, and track via the live API', async () => {
  const calls = [];
  const restore = mockFetch(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/track/')) {
      return jsonResponse({
        reference_no: 'REF-20261021-000001',
        report_type: 'missing',
        status: 'submitted',
        created_at: '2026-10-21T10:00:00.000Z',
      });
    }
    if (url.endsWith('/reports/me')) {
      return jsonResponse([{
        report_id: 'report-id',
        reference_no: 'REF-20261021-000001',
        report_type: 'missing',
        status: 'submitted',
        created_at: '2026-10-21T10:00:00.000Z',
      }]);
    }
    return jsonResponse({ reference_no: 'REF-20261021-000001' });
  });

  try {
    const submitted = await reportService.submitReport({
      reportType: 'missing',
      reporter: { name: 'Reporter', email: 'reporter@example.test', phone: '9876543210' },
      person: { name: 'Test Person', age: 20, gender: 'unknown', date: '2026-10-20' },
      location: {
        address: 'Test Road',
        pincode: '560001',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
      },
      description: 'Test report.',
    });
    assert.deepEqual(submitted, { referenceNo: 'REF-20261021-000001' });
    assert.equal(calls[0].url, 'http://localhost:3000/api/reports');
    assert.equal(JSON.parse(calls[0].options.body).report_type, 'missing');

    const mine = await reportService.getMyReports();
    assert.equal(mine[0].reportId, 'report-id');
    assert.equal(calls[1].url, 'http://localhost:3000/api/reports/me');

    const tracked = await reportService.trackReport('REF/2026?21', 'pin value');
    assert.equal(tracked.referenceNo, 'REF-20261021-000001');
    assert.equal(tracked.statusLabel, 'Received');
    assert.equal(
      calls[2].url,
      'http://localhost:3000/api/reports/track/REF%2F2026%3F21?pin=pin%20value',
    );
  } finally {
    restore();
  }
});

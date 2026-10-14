/**
 * reportService – for authenticated individual users.
 * Public functions never return: reporter details, reviewNote,
 * assignedOfficer, or verification data.
 */
import { MOCK_REPORTS } from '../mock/reports.js';
import { withLatency } from '../mock/latency.js';
import { getCurrentUser } from './authService.js';

/** Publicly safe report view (reporter's own view) */
function toReporterView(r) {
  return {
    reportId:    r.reportId,
    referenceNo: r.referenceNo,
    reportType:  r.reportType,
    status:      r.status,
    createdDate: r.createdDate,
    dateReported: r.dateReported,
    description: r.description,
    person:      r.person,
    location:    r.location,
  };
}

/** Public track view (minimal, for /track page) */
function toTrackView(r) {
  const statusMap = {
    submitted:    'Received',
    under_review: 'Under Review',
    info_requested: 'Information Requested',
    approved:     'Approved',
    rejected:     'Rejected',
    closed:       'Closed',
  };
  return {
    referenceNo:  r.referenceNo,
    reportType:   r.reportType,
    status:       r.status,
    statusLabel:  statusMap[r.status] ?? r.status,
    createdDate:  r.createdDate,
    // Special message for info_requested
    infoMessage:  r.status === 'info_requested'
      ? 'An officer needs more information. Check your email or contact the helpline.'
      : null,
  };
}

/**
 * Submit a new report.
 * Returns only the referenceNo (no internal details).
 */
export async function submitReport(_payload) {
  return withLatency(() => {
    const refDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const refNo = `REF-${refDate}-${String(MOCK_REPORTS.length + 1).padStart(3, '0')}`;
    // In the mock, we don't persist. Return success.
    return { referenceNo: refNo };
  });
}

/**
 * Track a report by referenceNo + email (privacy: both required).
 * Never returns reviewNote.
 */
export async function trackReport({ referenceNo, email }) {
  return withLatency(() => {
    const r = MOCK_REPORTS.find(
      rep => rep.referenceNo === referenceNo &&
             rep.reporter?.email?.toLowerCase() === email.toLowerCase()
    );
    if (!r) throw new Error('No record found for the reference number and email provided.');
    return toTrackView(r);
  });
}

/** List reports belonging to the current user (mock: returns reporter's own reports) */
export async function listMyReports() {
  return withLatency(() => {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated.');
    // In the mock, return the first reporter's reports for individual users
    const email = user.email.toLowerCase();
    const mine = MOCK_REPORTS.filter(r =>
      r.reporter?.email?.toLowerCase() === email
    );
    return mine.map(toReporterView);
  });
}

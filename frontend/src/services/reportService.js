/**
 * reportService – for authenticated individual users.
 * Public functions never return: reporter details, reviewNote,
 * assignedOfficer, or verification data.
 */
import { MOCK_REPORTS } from '../mock/reports.js';
import { withLatency } from '../mock/latency.js';
import { getCurrentUser } from './authService.js';

const SUBMITTED_REPORTS_KEY = 'ia-submitted-reports';

function getSubmittedReports() {
  try {
    const stored = sessionStorage.getItem(SUBMITTED_REPORTS_KEY);
    if (!stored) return [];
    const reports = JSON.parse(stored);
    if (!Array.isArray(reports)) throw new Error('Saved mock reports are invalid.');
    return reports;
  } catch (error) {
    if (error instanceof Error && error.message === 'Saved mock reports are invalid.') throw error;
    throw new Error('Saved mock reports could not be read from this browser session.');
  }
}

function saveSubmittedReports(reports) {
  try {
    sessionStorage.setItem(SUBMITTED_REPORTS_KEY, JSON.stringify(reports));
  } catch {
    throw new Error('The report could not be saved in this browser session. Please try again.');
  }
}

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
    info_requested: 'Info Needed',
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
    timeline: [{
      statusLabel: statusMap[r.status] ?? r.status,
      date: r.dateReported ?? r.createdDate.slice(0, 10),
    }],
    infoMessage:  r.status === 'info_requested'
      ? 'An officer needs more information. Check your email or contact the helpline.'
      : null,
  };
}

/**
 * Submit a new report.
 * Returns only the referenceNo (no internal details).
 */
export async function submitReport(payload) {
  return withLatency(() => {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated.');
    const existingReports = getSubmittedReports();
    const refDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = [...MOCK_REPORTS, ...existingReports]
      .filter((report) => report.referenceNo.startsWith(`REF-${refDate}-`))
      .length + 1;
    const refNo = `REF-${refDate}-${String(sequence).padStart(3, '0')}`;
    const dateReported = new Date().toISOString().slice(0, 10);
    const report = {
      ...payload,
      reportId: `rep-${Date.now()}-${sequence}`,
      referenceNo: refNo,
      status: 'submitted',
      priority: 'normal',
      createdDate: new Date().toISOString(),
      dateReported,
      reporter: {
        name: user.name,
        phone: payload.reporter.phone,
        email: user.email,
      },
    };
    saveSubmittedReports([...existingReports, report]);
    return { referenceNo: refNo };
  });
}

/**
 * Track a report by referenceNo + email (privacy: both required).
 * Never returns reviewNote.
 */
export async function trackReport({ referenceNo, email }) {
  return withLatency(() => {
    const reports = [...MOCK_REPORTS, ...getSubmittedReports()];
    const r = reports.find(
      (rep) => rep.referenceNo.toLowerCase() === referenceNo.trim().toLowerCase() &&
        rep.reporter?.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (!r) throw new Error('No report found for those details.');
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
    const mine = [...MOCK_REPORTS, ...getSubmittedReports()].filter((r) =>
      r.reporter?.email?.toLowerCase() === email
    );
    return mine.map(toReporterView);
  });
}

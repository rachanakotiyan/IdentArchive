import apiClient from './apiClient.js';

const STATUS_LABELS = {
  submitted: 'Received',
  under_review: 'Under Review',
  info_requested: 'Info Needed',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
};

function getResponseData(response) {
  return response?.data ?? response;
}

function reportView(report = {}) {
  return {
    reportId: report.report_id ?? report.reportId,
    referenceNo: report.reference_no ?? report.referenceNo,
    reportType: report.report_type ?? report.reportType,
    status: report.status,
    createdDate: report.created_at ?? report.createdDate,
    dateReported: report.event_date ?? report.dateReported,
    description: report.description,
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
  };
}

function trackView(report = {}) {
  const item = reportView(report);
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const date = item.dateReported || item.createdDate?.slice?.(0, 10) || '';
  return {
    referenceNo: item.referenceNo,
    reportType: item.reportType,
    status: item.status,
    statusLabel,
    createdDate: item.createdDate,
    timeline: [{ statusLabel, date }],
    infoMessage: item.status === 'info_requested'
      ? 'An officer needs more information. Check your email or contact the helpline.'
      : null,
  };
}

/**
 * Submit a report for the authenticated user.
 * The backend derives the reference number and returns it in the report record.
 */
export async function submitReport(payload) {
  const reporter = payload.reporter ?? {};
  const person = payload.person ?? {};
  const location = payload.location ?? {};
  const response = await apiClient.post('/reports', {
    report_type: payload.reportType ?? payload.report_type,
    reporter_name: reporter.name ?? payload.reporter_name,
    reporter_email: reporter.email ?? payload.reporter_email,
    reporter_phone: reporter.phone ?? payload.reporter_phone,
    person_name: person.name ?? payload.person_name,
    age: person.age ?? payload.age ?? null,
    gender: person.gender ?? payload.gender,
    height_cm: person.heightCm ?? payload.height_cm ?? null,
    physical_features: person.physicalFeatures ?? payload.physical_features ?? null,
    identifying_marks: person.identifyingMarks ?? payload.identifying_marks ?? null,
    event_date: person.date ?? payload.event_date,
    description: payload.description,
    location_address: location.address ?? payload.location_address,
    location_pincode: location.pincode ?? payload.location_pincode,
    location_city: location.city ?? payload.location_city,
    location_district: location.district ?? payload.location_district,
    location_state: location.state ?? payload.location_state,
  });
  const report = getResponseData(response);
  return { referenceNo: report.reference_no ?? report.referenceNo };
}

/** Fetch the authenticated user's own reports. */
export async function getMyReports() {
  const response = await apiClient.get('/reports/me');
  const reports = getResponseData(response);
  return (Array.isArray(reports) ? reports : []).map(reportView);
}

/** Existing page-facing alias. */
export const listMyReports = getMyReports;

/**
 * Track a report using its reference number and tracking PIN.
 */
export async function trackReport(referenceNo, pin) {
  const endpoint = `/reports/track/${encodeURIComponent(referenceNo)}?pin=${encodeURIComponent(pin)}`;
  const response = await apiClient.get(endpoint);
  return trackView(getResponseData(response));
}

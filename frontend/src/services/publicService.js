import apiClient from './apiClient.js';
import { MOCK_CASES } from '../mock/cases.js';
import { MOCK_PINCODES } from '../mock/pincodes.js';
import { withLatency } from '../mock/latency.js';

const PUBLIC_STATUSES = ['open', 'under_review', 'resolved'];

function caseView(record = {}) {
  return {
    caseId: record.case_id ?? record.caseId,
    caseNumber: record.case_number ?? record.caseNumber,
    title: record.title,
    crimeType: record.crime_type ?? record.crimeType,
    caseStatus: record.case_status ?? record.caseStatus,
    kind: record.kind,
    personName: record.person_name ?? record.personName ?? null,
    age: record.age ?? null,
    estimatedAge: record.estimated_age ?? record.estimatedAge ?? null,
    gender: record.gender,
    date: record.event_date ?? record.date,
    shortDescription: record.short_description ?? record.shortDescription,
    city: record.city,
    district: record.district,
    state: record.state,
    description: record.description,
    physicalFeatures: record.physical_features ?? record.physicalFeatures,
    identifyingMarks: record.identifying_marks ?? record.identifyingMarks,
    heightCm: record.height_cm ?? record.heightCm,
    updates: (record.updates ?? []).map(updateView),
  };
}

function updateView(update = {}) {
  return {
    date: update.update_date ?? update.date,
    note: update.note,
  };
}

function buildCaseQuery(params = {}) {
  const query = new URLSearchParams();
  const aliases = {
    kind: 'case_type',
    caseType: 'case_type',
    status: 'case_status',
    caseStatus: 'case_status',
    minAge: 'age_min',
    maxAge: 'age_max',
    pageSize: 'limit',
  };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(aliases[key] || key, String(value));
  }
  return query.toString();
}

function getResponseData(response) {
  return response?.data ?? response;
}

/**
 * Fetch public cases with optional filters and pagination.
 * @param {object} params
 * @returns {Promise<{items: object[], total: number, page: number, pageSize: number}>}
 */
export async function getCases(params = {}) {
  const query = buildCaseQuery(params);
  const response = await apiClient.get(`/cases${query ? `?${query}` : ''}`);
  const records = getResponseData(response);
  const meta = response?.meta ?? {};
  const page = Number(meta.page ?? params.page ?? 1);
  const pageSize = Number(meta.limit ?? params.pageSize ?? params.limit ?? 20);
  return {
    items: (Array.isArray(records) ? records : records?.items ?? records?.cases ?? []).map(caseView),
    total: Number(meta.total ?? records?.total ?? 0),
    page,
    pageSize,
  };
}

/**
 * Backwards-compatible adapter for the existing public cases page.
 */
export function listCases(filters = {}, page = 1, pageSize = 12) {
  return getCases({ ...filters, page, pageSize });
}

export async function getCaseByNumber(caseNumber) {
  const response = await apiClient.get(`/cases/${encodeURIComponent(caseNumber)}`);
  return caseView(getResponseData(response));
}

export async function getCaseUpdates(caseNumber) {
  const response = await apiClient.get(`/cases/${encodeURIComponent(caseNumber)}/updates`);
  const updates = getResponseData(response);
  return (Array.isArray(updates) ? updates : []).map(updateView);
}

/** Backwards-compatible detail adapter used by CaseDetailPage. */
export async function getCase(caseNumber) {
  const [record, updates] = await Promise.all([
    getCaseByNumber(caseNumber),
    getCaseUpdates(caseNumber),
  ]);
  return { ...record, updates };
}

export async function getPublicStats() {
  return withLatency(() => {
    const publicCases = MOCK_CASES.filter((item) => PUBLIC_STATUSES.includes(item.caseStatus));
    return {
      activeCases: publicCases.filter((item) => item.caseStatus === 'open').length,
      underReview: publicCases.filter((item) => item.caseStatus === 'under_review').length,
      resolvedCases: publicCases.filter((item) => item.caseStatus === 'resolved').length,
      reportsThisWeek: 4,
    };
  });
}

export async function getPinInfo(pincode) {
  return withLatency(() => {
    const info = MOCK_PINCODES[pincode];
    if (!info) throw new Error('Pincode not found in the demo database.');
    return info;
  });
}

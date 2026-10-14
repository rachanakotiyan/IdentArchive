/**
 * publicService – data available to unauthenticated users.
 * Privacy rule: NEVER return reporter details, reviewNote,
 * assignedOfficer, verification data, or unverified reports.
 * Only cases with status: open | under_review | resolved appear here.
 */
import { MOCK_CASES } from '../mock/cases.js';
import { MOCK_PINCODES } from '../mock/pincodes.js';
import { withLatency } from '../mock/latency.js';

const PUBLIC_STATUSES = ['open', 'under_review', 'resolved'];

/** Return only the fields the public is allowed to see */
function toPublicCase(c) {
  return {
    caseId:           c.caseId,
    caseNumber:       c.caseNumber,
    title:            c.title,
    crimeType:        c.crimeType,
    caseStatus:       c.caseStatus,
    kind:             c.kind,
    personName:       c.personName ?? null,
    age:              c.age ?? null,
    estimatedAge:     c.estimatedAge ?? null,
    gender:           c.gender,
    date:             c.date,
    shortDescription: c.shortDescription,
    city:             c.city,
    district:         c.district,
    state:            c.state,
  };
}

function toPublicCaseDetail(c) {
  return {
    ...toPublicCase(c),
    description:       c.description,
    physicalFeatures:  c.physicalFeatures,
    identifyingMarks:  c.identifyingMarks,
    heightCm:          c.heightCm,
    updates:           c.updates ?? [],
  };
}

/**
 * @param {object} filters - { kind, status, gender, minAge, maxAge, fromDate, toDate, query }
 * @param {number} page
 * @param {number} pageSize
 */
export async function listCases(filters = {}, page = 1, pageSize = 12) {
  return withLatency(() => {
    let results = MOCK_CASES.filter(c => PUBLIC_STATUSES.includes(c.caseStatus));

    if (filters.kind)   results = results.filter(c => c.kind === filters.kind);
    if (filters.status) results = results.filter(c => c.caseStatus === filters.status);
    if (filters.gender) results = results.filter(c => c.gender === filters.gender);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(c =>
        (c.personName && c.personName.toLowerCase().includes(q)) ||
        c.caseNumber.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      );
    }

    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize).map(toPublicCase);

    return { items, total, page, pageSize };
  });
}

export async function getCase(caseId) {
  return withLatency(() => {
    const c = MOCK_CASES.find(c => c.caseId === caseId);
    if (!c) throw new Error('Case not found.');
    if (!PUBLIC_STATUSES.includes(c.caseStatus)) throw new Error('Case not found.');
    return toPublicCaseDetail(c);
  });
}

export async function getPublicStats() {
  return withLatency(() => {
    const publicCases = MOCK_CASES.filter(c => PUBLIC_STATUSES.includes(c.caseStatus));
    return {
      activeCases:   publicCases.filter(c => c.caseStatus === 'open').length,
      underReview:   publicCases.filter(c => c.caseStatus === 'under_review').length,
      resolvedCases: publicCases.filter(c => c.caseStatus === 'resolved').length,
      reportsThisWeek: 4, // mock static
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

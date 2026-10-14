/**
 * Public privacy boundary: expose only the allowlisted public case fields below.
 * Never return reporter details, review notes, assigned officers, verification
 * data, or reports that have not become public cases. Only open, under-review,
 * and resolved cases are visible through this service.
 */
import { MOCK_CASES } from '../mock/cases.js';
import { MOCK_PINCODES } from '../mock/pincodes.js';
import { withLatency } from '../mock/latency.js';

const PUBLIC_STATUSES = ['open', 'under_review', 'resolved'];

function ageRangeMatches(caseItem, minAge, maxAge) {
  if (minAge == null && maxAge == null) return true;
  const minimum = minAge == null ? Number.NEGATIVE_INFINITY : Number(minAge);
  const maximum = maxAge == null ? Number.POSITIVE_INFINITY : Number(maxAge);
  if (minAge != null && !Number.isFinite(minimum)) return false;
  if (maxAge != null && !Number.isFinite(maximum)) return false;

  if (Number.isFinite(caseItem.age)) {
    return caseItem.age >= minimum && caseItem.age <= maximum;
  }

  const estimated = String(caseItem.estimatedAge ?? '').match(/\d+/g);
  if (!estimated?.length) return false;
  const ages = estimated.map(Number);
  const estimatedMin = Math.min(...ages);
  const estimatedMax = Math.max(...ages);
  return estimatedMax >= minimum && estimatedMin <= maximum;
}

function sortPublicCases(results, sort) {
  const sorted = [...results];
  if (sort === 'oldest') return sorted.sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  if (sort === 'name') {
    return sorted.sort((a, b) =>
      String(a.personName || a.title || '').localeCompare(String(b.personName || b.title || ''), undefined, { sensitivity: 'base' })
    );
  }
  return sorted.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}

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
    updates:           (c.updates ?? []).map(({ date, note }) => ({ date, note })),
  };
}

/**
 * @param {object} filters - { kind, status, gender, minAge, maxAge, fromDate, toDate, query, sort }
 * @param {number} page
 * @param {number} pageSize
 */
export async function listCases(filters = {}, page = 1, pageSize = 12) {
  return withLatency(() => {
    let results = MOCK_CASES.filter(c => PUBLIC_STATUSES.includes(c.caseStatus));

    if (filters.kind)   results = results.filter(c => c.kind === filters.kind);
    if (filters.status) results = results.filter(c => c.caseStatus === filters.status);
    if (filters.gender) results = results.filter(c => c.gender === filters.gender);
    if (filters.minAge != null || filters.maxAge != null) {
      results = results.filter(c => ageRangeMatches(c, filters.minAge, filters.maxAge));
    }
    if (filters.fromDate) results = results.filter(c => c.date >= filters.fromDate);
    if (filters.toDate) results = results.filter(c => c.date <= filters.toDate);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(c =>
        String(c.personName ?? '').toLowerCase().includes(q) ||
        String(c.caseNumber ?? '').toLowerCase().includes(q) ||
        String(c.city ?? '').toLowerCase().includes(q) ||
        String(c.title ?? '').toLowerCase().includes(q)
      );
    }

    results = sortPublicCases(results, filters.sort);
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

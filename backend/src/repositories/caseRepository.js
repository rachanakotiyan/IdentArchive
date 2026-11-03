import pool from '../config/database.js'

/**
 * The only case_status values that are allowed on the public API.
 * Any other status (e.g. 'closed') must never appear in public responses.
 */
export const PUBLIC_STATUSES = ['open', 'under_review', 'resolved']

/**
 * Standard public case fields to select from the `cases` table.
 * Must NOT include reporter_*, assigned_officer_id, review_note, or any
 * other field that the schema docs flag as internal-only.
 */
export const CASE_FIELDS = `
  c.case_number,
  c.title,
  c.crime_type,
  c.case_status,
  c.kind,
  c.person_name,
  c.age,
  c.estimated_age,
  c.gender,
  c.event_date,
  c.short_description,
  c.description,
  c.physical_features,
  c.identifying_marks,
  c.height_cm,
  c.city,
  c.district,
  c.state,
  c.created_at,
  c.updated_at
`

/**
 * Search and filter cases using parameterized MySQL queries with pagination.
 * Only cases with a public status (open / under_review / resolved) are ever returned.
 * If the caller requests a non-public status (e.g. 'closed') the result is an empty list.
 *
 * @param {object} [filters={}]
 * @param {string} [filters.case_type] - Matches kind ('missing'/'found') or crime_type (e.g. 'missing_person')
 * @param {string} [filters.pincode]   - Matches via linked intake report or pincodes lookup
 * @param {string} [filters.district]  - Location district filter
 * @param {string} [filters.state]     - Location state filter
 * @param {string} [filters.gender]    - Gender filter ('male'|'female'|'other'|'unknown')
 * @param {number|string} [filters.age_min] - Minimum age
 * @param {number|string} [filters.age_max] - Maximum age
 * @param {string} [filters.query]     - Free text search across title, name, description, city, case number
 * @param {string} [filters.case_status] - Restrict to one of the public statuses; non-public → empty list
 * @param {number} [filters.page=1]    - 1-based page number
 * @param {number} [filters.limit=20]  - Results per page (max 100)
 * @param {import('mysql2/promise').Connection|null} [conn=null] - Optional connection for transactions
 * @returns {Promise<Array<object>&{ total: number, page: number, limit: number, totalPages: number }>}
 */
export async function searchCases(
  {
    case_type,
    caseType,
    pincode,
    district,
    state,
    gender,
    age_min,
    age_max,
    minAge,
    maxAge,
    query,
    q,
    case_status,
    caseStatus,
    status,
    kind,
    page = 1,
    limit = 20,
    pageSize,
  } = {},
  conn = null
) {
  const executor = conn || pool

  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20)))
  const offset = (safePage - 1) * safeLimit

  // Resolve the requested status filter
  const requestedStatus = (case_status ?? caseStatus ?? status)
  const requestedStatusNorm = requestedStatus !== undefined && requestedStatus !== null && String(requestedStatus).trim() !== ''
    ? String(requestedStatus).trim().toLowerCase()
    : null

  // If the caller asked for a non-public status, return an empty list immediately.
  if (requestedStatusNorm !== null && !PUBLIC_STATUSES.includes(requestedStatusNorm)) {
    const empty = []
    empty.total = 0
    empty.page = safePage
    empty.limit = safeLimit
    empty.totalPages = 1
    empty.cases = empty
    empty.items = empty
    return empty
  }

  const where = []
  const params = []

  // ALWAYS restrict to public statuses.
  if (requestedStatusNorm !== null) {
    // Caller filtered to a specific public status
    where.push('c.case_status = ?')
    params.push(requestedStatusNorm)
  } else {
    // Default: all public statuses
    where.push(`c.case_status IN (${PUBLIC_STATUSES.map(() => '?').join(', ')})`)
    params.push(...PUBLIC_STATUSES)
  }

  // Filter: case_type (supports both kind: 'missing'/'found' and crime_type: 'missing_person'/etc.)
  const typeFilter = case_type ?? caseType
  if (typeFilter !== undefined && typeFilter !== null && String(typeFilter).trim() !== '') {
    const norm = String(typeFilter).trim().toLowerCase()
    where.push('(LOWER(c.kind) = ? OR LOWER(c.crime_type) = ?)')
    params.push(norm, norm)
  }

  // Filter: kind ('missing' | 'found') if explicitly supplied without case_type
  if (kind !== undefined && kind !== null && String(kind).trim() !== '' && !typeFilter) {
    where.push('LOWER(c.kind) = ?')
    params.push(String(kind).trim().toLowerCase())
  }

  // Filter: gender
  if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
    where.push('LOWER(c.gender) = ?')
    params.push(String(gender).trim().toLowerCase())
  }

  // Filter: district
  if (district !== undefined && district !== null && String(district).trim() !== '') {
    where.push('LOWER(c.district) = LOWER(?)')
    params.push(String(district).trim())
  }

  // Filter: state
  if (state !== undefined && state !== null && String(state).trim() !== '') {
    where.push('LOWER(c.state) = LOWER(?)')
    params.push(String(state).trim())
  }

  // Filter: pincode (checks linked report's location_pincode or pincodes reference table)
  if (pincode !== undefined && pincode !== null && String(pincode).trim() !== '') {
    const pin = String(pincode).trim()
    where.push(`(
      EXISTS (
        SELECT 1 FROM reports r
        WHERE r.case_id = c.case_id AND r.location_pincode = ?
      )
      OR EXISTS (
        SELECT 1 FROM pincodes p
        WHERE p.pincode = ?
          AND (
            LOWER(p.district) = LOWER(c.district)
            OR LOWER(p.city) = LOWER(c.city)
          )
      )
    )`)
    params.push(pin, pin)
  }

  // Filter: age_min
  const effectiveMinAge = age_min ?? minAge
  if (effectiveMinAge !== undefined && effectiveMinAge !== null && String(effectiveMinAge).trim() !== '') {
    const num = Number(effectiveMinAge)
    if (!Number.isNaN(num)) {
      where.push('c.age >= ?')
      params.push(num)
    }
  }

  // Filter: age_max
  const effectiveMaxAge = age_max ?? maxAge
  if (effectiveMaxAge !== undefined && effectiveMaxAge !== null && String(effectiveMaxAge).trim() !== '') {
    const num = Number(effectiveMaxAge)
    if (!Number.isNaN(num)) {
      where.push('c.age <= ?')
      params.push(num)
    }
  }

  // Filter: query (free text search across case_number, title, person_name, descriptions, city)
  const queryFilter = query ?? q
  if (queryFilter !== undefined && queryFilter !== null && String(queryFilter).trim() !== '') {
    const qStr = String(queryFilter).trim()
    where.push(`(
      c.case_number LIKE ?
      OR c.title LIKE ?
      OR c.person_name LIKE ?
      OR c.short_description LIKE ?
      OR c.description LIKE ?
      OR c.city LIKE ?
    )`)
    const likeVal = `%${qStr}%`
    params.push(likeVal, likeVal, likeVal, likeVal, likeVal, likeVal)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  // Execute COUNT query for pagination metadata
  const countSql = `SELECT COUNT(*) AS total FROM cases c ${whereClause}`
  const [countRows] = await executor.execute(countSql, params)
  const total = Number(countRows[0]?.total || 0)

  // Execute paginated SELECT query
  const selectSql = `
    SELECT ${CASE_FIELDS}
    FROM cases c
    ${whereClause}
    ORDER BY c.event_date DESC, c.created_at DESC
    LIMIT ? OFFSET ?
  `
  const [rows] = await executor.execute(selectSql, [...params, safeLimit, offset])

  // Attach pagination metadata for dual compatibility:
  // Array consumers: rows.length, rows[0], etc.
  // Object destructuring: const { cases, total, page, limit } = await searchCases(...)
  rows.total = total
  rows.page = safePage
  rows.limit = safeLimit
  rows.totalPages = Math.ceil(total / safeLimit) || 1
  rows.cases = rows
  rows.items = rows

  return rows
}

/**
 * Retrieve a public case row by its unique case_number.
 * Returns null if the case does not exist or has a non-public status (e.g. 'closed').
 * Only looks up by case_number (never by internal case_id).
 *
 * @param {string} caseNumber
 * @param {import('mysql2/promise').Connection|null} [conn=null]
 * @returns {Promise<object|null>}
 */
export async function getCaseByNumber(caseNumber, conn = null) {
  if (!caseNumber || String(caseNumber).trim() === '') {
    return null
  }

  const executor = conn || pool
  const cleanNumber = String(caseNumber).trim()

  const [rows] = await executor.execute(
    `SELECT ${CASE_FIELDS}
     FROM cases c
     WHERE c.case_number = ?
       AND c.case_status IN (${PUBLIC_STATUSES.map(() => '?').join(', ')})
     LIMIT 1`,
    [cleanNumber, ...PUBLIC_STATUSES]
  )

  return rows[0] || null
}

/**
 * Retrieve public updates/milestones for a case given its case_number.
 * The parent case must exist and have a public status; otherwise returns null
 * (the controller should 404 in that situation).
 *
 * @param {string} caseNumber
 * @param {import('mysql2/promise').Connection|null} [conn=null]
 * @returns {Promise<Array<object>|null>} null if parent case not found/not public
 */
export async function getCaseUpdates(caseNumber, conn = null) {
  if (!caseNumber || String(caseNumber).trim() === '') {
    return []
  }

  const executor = conn || pool
  const cleanNumber = String(caseNumber).trim()

  const [rows] = await executor.execute(
    `SELECT
       u.update_date,
       u.update_date AS date,
       u.note,
       u.created_at
     FROM case_updates u
     JOIN cases c ON c.case_id = u.case_id
     WHERE c.case_number = ?
       AND c.case_status IN (${PUBLIC_STATUSES.map(() => '?').join(', ')})
     ORDER BY u.update_date ASC, u.created_at ASC`,
    [cleanNumber, ...PUBLIC_STATUSES]
  )

  return rows
}



import pool from '../config/database.js'

/**
 * Standard public case fields to select from the `cases` table.
 */
export const CASE_FIELDS = `
  c.case_id,
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
 * @param {number} [filters.page=1]    - 1-based page number
 * @param {number} [filters.limit=20]  - Results per page (max 100)
 * @param {import('mysql2/promise').Connection|null} [conn=null] - Optional connection for transactions
 * @returns {Promise<Array<object>&{ total: number, page: number, limit: number, totalPages: number, cases: Array<object> }>}
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

  const where = []
  const params = []

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

  // Filter: case_status / status (e.g. 'open', 'under_review', 'resolved', 'closed')
  const statusFilter = case_status ?? caseStatus ?? status
  if (statusFilter !== undefined && statusFilter !== null && String(statusFilter).trim() !== '') {
    where.push('LOWER(c.case_status) = ?')
    params.push(String(statusFilter).trim().toLowerCase())
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
 * Retrieve a case row by its unique case number (or case ID).
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
     WHERE c.case_number = ? OR c.case_id = ?
     LIMIT 1`,
    [cleanNumber, cleanNumber]
  )

  return rows[0] || null
}

/**
 * Retrieve public updates/milestones for a case given its case number (or case ID).
 * Uses a parameterized query against `cases` and `case_updates` tables.
 *
 * @param {string} caseNumber
 * @param {import('mysql2/promise').Connection|null} [conn=null]
 * @returns {Promise<Array<object>>}
 */
export async function getCaseUpdates(caseNumber, conn = null) {
  if (!caseNumber || String(caseNumber).trim() === '') {
    return []
  }

  const executor = conn || pool
  const cleanNumber = String(caseNumber).trim()

  const [rows] = await executor.execute(
    `SELECT
       u.id,
       u.case_id,
       u.update_date,
       u.update_date AS date,
       u.note,
       u.created_at
     FROM case_updates u
     JOIN cases c ON c.case_id = u.case_id
     WHERE c.case_number = ? OR c.case_id = ?
     ORDER BY u.update_date ASC, u.created_at ASC`,
    [cleanNumber, cleanNumber]
  )

  return rows
}

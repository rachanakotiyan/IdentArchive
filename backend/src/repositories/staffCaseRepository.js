import pool from '../config/database.js'
import { AppError } from '../utils/errors.js'

const CASE_SELECT_FIELDS = `
  c.case_id, c.case_number, c.title, c.crime_type, c.case_status, c.kind,
  c.person_name, c.age, c.estimated_age, c.gender, c.event_date,
  c.short_description, c.description, c.physical_features, c.identifying_marks,
  c.height_cm, c.city, c.district, c.state, c.created_at, c.updated_at,
  r.report_id, r.reference_no AS report_reference_no,
  r.assigned_officer_id,
  u_off.name AS assigned_officer_name,
  o.badge AS assigned_officer_badge
`

/**
 * List cases visible to staff with caller-based scoping.
 * Rule: officers see only cases where linked report is assigned to them or unassigned;
 * admins see all cases.
 */
export async function listStaffCases({
  case_status,
  status,
  kind,
  case_type,
  q,
  query,
  page = 1,
  limit = 20,
  pageSize,
  user,
  officerId,
} = {}) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20)))
  const offset = (safePage - 1) * safeLimit

  const where = []
  const params = []

  // 1. Caller role scoping
  const role = user?.role || 'officer'
  if (role === 'officer') {
    if (officerId) {
      where.push('(r.assigned_officer_id = ? OR r.assigned_officer_id IS NULL OR r.case_id IS NULL)')
      params.push(officerId)
    } else {
      where.push('(r.assigned_officer_id IS NULL OR r.case_id IS NULL)')
    }
  }

  // 2. Case status filter
  const effectiveStatus = case_status || status
  if (effectiveStatus && effectiveStatus !== 'all' && String(effectiveStatus).trim() !== '') {
    where.push('c.case_status = ?')
    params.push(String(effectiveStatus).toLowerCase().trim())
  }

  // 3. Kind / case_type filter
  const effectiveKind = kind || case_type
  if (effectiveKind && effectiveKind !== 'all' && String(effectiveKind).trim() !== '') {
    where.push('c.kind = ?')
    params.push(String(effectiveKind).toLowerCase().trim())
  }

  // 4. Search query filter
  const searchText = q || query
  if (searchText && String(searchText).trim() !== '') {
    const term = `%${String(searchText).trim()}%`
    where.push(`(
      c.case_number LIKE ?
      OR c.title LIKE ?
      OR c.person_name LIKE ?
      OR c.city LIKE ?
    )`)
    params.push(term, term, term, term)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const countSql = `
    SELECT COUNT(*) AS total
    FROM cases c
    LEFT JOIN reports r ON r.case_id = c.case_id
    ${whereClause}
  `
  const [countRows] = await pool.execute(countSql, params)
  const total = Number(countRows[0]?.total || 0)

  const selectSql = `
    SELECT ${CASE_SELECT_FIELDS}
    FROM cases c
    LEFT JOIN reports r ON r.case_id = c.case_id
    LEFT JOIN officers o ON o.officer_id = r.assigned_officer_id
    LEFT JOIN users u_off ON u_off.user_id = o.user_id
    ${whereClause}
    ORDER BY c.event_date DESC, c.created_at DESC
    LIMIT ? OFFSET ?
  `
  const [rows] = await pool.execute(selectSql, [...params, safeLimit, offset])

  rows.total = total
  rows.page = safePage
  rows.limit = safeLimit
  rows.totalPages = Math.ceil(total / safeLimit) || 1
  rows.items = rows

  return rows
}

/**
 * Retrieve case detail by case_id or case_number, along with linked report,
 * assigned officer info, updates, matches, and report history.
 */
export async function getStaffCaseDetail(caseIdOrNumber) {
  if (!caseIdOrNumber || !String(caseIdOrNumber).trim()) return null

  const clean = String(caseIdOrNumber).trim()

  const [rows] = await pool.execute(
    `SELECT
       c.case_id, c.case_number, c.title, c.crime_type, c.case_status, c.kind,
       c.person_name, c.age, c.estimated_age, c.gender, c.event_date,
       c.short_description, c.description, c.physical_features, c.identifying_marks,
       c.height_cm, c.city, c.district, c.state, c.created_at, c.updated_at,
       r.report_id, r.reference_no AS report_reference_no,
       r.reporter_name, r.reporter_phone, r.reporter_email,
       r.assigned_officer_id,
       u_off.name AS assigned_officer_name,
       o.badge AS assigned_officer_badge,
       o.district AS assigned_officer_district
     FROM cases c
     LEFT JOIN reports r ON r.case_id = c.case_id
     LEFT JOIN officers o ON o.officer_id = r.assigned_officer_id
     LEFT JOIN users u_off ON u_off.user_id = o.user_id
     WHERE c.case_id = ? OR c.case_number = ?
     LIMIT 1`,
    [clean, clean]
  )

  const caseItem = rows[0]
  if (!caseItem) return null

  // 1. Case updates
  const [updates] = await pool.execute(
    `SELECT id, case_id, update_date, note, created_at
     FROM case_updates
     WHERE case_id = ?
     ORDER BY update_date ASC, created_at ASC`,
    [caseItem.case_id]
  )

  // 2. Candidate matches linked to this case
  const [matches] = await pool.execute(
    `SELECT
       m.match_id, m.missing_case_id, m.found_case_id, m.similarity_score, m.status,
       m.created_at, m.updated_at,
       mc.case_number AS missing_case_number, mc.title AS missing_case_title, mc.person_name AS missing_person_name,
       fc.case_number AS found_case_number, fc.title AS found_case_title, fc.person_name AS found_person_name
     FROM matches m
     JOIN cases mc ON mc.case_id = m.missing_case_id
     JOIN cases fc ON fc.case_id = m.found_case_id
     WHERE m.missing_case_id = ? OR m.found_case_id = ?
     ORDER BY m.similarity_score DESC, m.created_at DESC`,
    [caseItem.case_id, caseItem.case_id]
  )

  // 3. Report history if linked report exists
  let history = []
  if (caseItem.report_id) {
    const [histRows] = await pool.execute(
      `SELECT rh.id, rh.event, rh.actor_id, rh.created_at, u.name AS actor_name
       FROM report_history rh
       LEFT JOIN users u ON u.user_id = rh.actor_id
       WHERE rh.report_id = ?
       ORDER BY rh.created_at ASC, rh.id ASC`,
      [caseItem.report_id]
    )
    history = histRows
  }

  caseItem.updates = updates
  caseItem.matches = matches
  caseItem.history = history

  return caseItem
}

/**
 * Add an update/note to a case.
 */
export async function addCaseUpdate(caseId, note, updateDate = null) {
  const cleanId = String(caseId).trim()
  const date = updateDate || new Date().toISOString().slice(0, 10)

  const [result] = await pool.execute(
    'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
    [cleanId, date, String(note).trim()]
  )

  const [rows] = await pool.execute(
    'SELECT id, case_id, update_date, note, created_at FROM case_updates WHERE id = ?',
    [result.insertId]
  )
  return rows[0]
}

/**
 * Reassign case officer (admin only).
 * Sets reports.assigned_officer_id and logs in case_updates.
 */
export async function assignCaseOfficer(caseId, targetOfficerId, actorId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // 1. Verify officer exists and is active
    const [officers] = await connection.execute(
      `SELECT o.officer_id, o.badge, u.name
       FROM officers o
       JOIN users u ON u.user_id = o.user_id
       WHERE o.officer_id = ? AND o.active = 1 LIMIT 1`,
      [targetOfficerId]
    )
    const officer = officers[0]
    if (!officer) {
      await connection.rollback()
      throw new AppError('Active target officer not found.', 404, 'NOT_FOUND')
    }

    // 2. Lock case
    const [cases] = await connection.execute(
      'SELECT case_id, case_number, case_status FROM cases WHERE case_id = ? OR case_number = ? LIMIT 1 FOR UPDATE',
      [caseId, caseId]
    )
    const caseRow = cases[0]
    if (!caseRow) {
      await connection.rollback()
      throw new AppError('Case not found.', 404, 'NOT_FOUND')
    }

    // 3. Update linked report if exists
    const [reports] = await connection.execute(
      'SELECT report_id FROM reports WHERE case_id = ? LIMIT 1',
      [caseRow.case_id]
    )
    if (reports[0]) {
      await connection.execute(
        'UPDATE reports SET assigned_officer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE case_id = ?',
        [officer.officer_id, caseRow.case_id]
      )
      await connection.execute(
        'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
        [reports[0].report_id, `Case assigned to officer ${officer.name} (${officer.badge})`, actorId]
      )
    }

    // 4. Insert note into case_updates
    const note = `Assigned to ${officer.name} (${officer.badge}) by admin`.slice(0, 255)
    await connection.execute(
      'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, CURRENT_DATE, ?)',
      [caseRow.case_id, note]
    )

    await connection.commit()
    return getStaffCaseDetail(caseRow.case_id)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Update case status: open | under_review | resolved.
 * Throws 409 if case is already closed.
 */
export async function updateCaseStatus(caseId, status) {
  const [rows] = await pool.execute(
    'SELECT case_id, case_status FROM cases WHERE case_id = ? OR case_number = ? LIMIT 1',
    [caseId, caseId]
  )
  const caseRow = rows[0]
  if (!caseRow) {
    throw new AppError('Case not found.', 404, 'NOT_FOUND')
  }

  if (caseRow.case_status === 'closed') {
    throw new AppError('Cannot change status of a closed case.', 409, 'CONFLICT')
  }

  await pool.execute(
    'UPDATE cases SET case_status = ?, updated_at = CURRENT_TIMESTAMP WHERE case_id = ?',
    [status, caseRow.case_id]
  )

  return getStaffCaseDetail(caseRow.case_id)
}

/**
 * Close a case: sets case_status = 'closed', adds a case_update entry,
 * and sets linked report status to 'closed'.
 * Throws 409 if case is already closed.
 */
export async function closeCase(caseId, note, actorId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [cases] = await connection.execute(
      'SELECT case_id, case_number, case_status FROM cases WHERE case_id = ? OR case_number = ? LIMIT 1 FOR UPDATE',
      [caseId, caseId]
    )
    const caseRow = cases[0]
    if (!caseRow) {
      await connection.rollback()
      throw new AppError('Case not found.', 404, 'NOT_FOUND')
    }

    if (caseRow.case_status === 'closed') {
      await connection.rollback()
      throw new AppError('Case is already closed.', 409, 'CONFLICT')
    }

    // 1. Update cases table
    await connection.execute(
      "UPDATE cases SET case_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE case_id = ?",
      [caseRow.case_id]
    )

    // 2. Add case update entry
    const updateNote = `Case closed. Reason: ${String(note).trim()}`.slice(0, 255)
    await connection.execute(
      'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, CURRENT_DATE, ?)',
      [caseRow.case_id, updateNote]
    )

    // 3. Update linked report and log history if linked report exists
    const [reports] = await connection.execute(
      'SELECT report_id, status FROM reports WHERE case_id = ? LIMIT 1 FOR UPDATE',
      [caseRow.case_id]
    )
    if (reports[0]) {
      if (reports[0].status !== 'closed' && reports[0].status !== 'rejected') {
        await connection.execute(
          "UPDATE reports SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE report_id = ?",
          [reports[0].report_id]
        )
      }
      await connection.execute(
        'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
        [reports[0].report_id, 'Case closed', actorId || null]
      )
    }

    await connection.commit()
    return getStaffCaseDetail(caseRow.case_id)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}


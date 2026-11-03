import crypto from 'node:crypto'
import pool from '../config/database.js'
import { AppError } from '../utils/errors.js'

const STAFF_REPORT_FIELDS = `
  r.report_id, r.reference_no, r.report_type, r.status, r.priority,
  r.reporter_name, r.reporter_phone, r.reporter_email, r.person_name,
  r.age, r.gender, r.description, r.event_date, r.location_address,
  r.location_pincode, r.location_city, r.location_district, r.location_state,
  r.assigned_officer_id, r.case_id, r.review_note, r.created_at, r.updated_at,
  u_off.name AS assigned_officer_name,
  o.badge AS assigned_officer_badge
`

const writableStatuses = ['submitted', 'under_review', 'info_requested']

/**
 * Get staff reports queue with caller-based scoping and filters.
 * Rule: officers see only reports assigned to them or unassigned; admins see all.
 */
export async function getStaffReportsQueue({
  status,
  priority,
  assigned,
  q,
  query,
  report_type,
  type,
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
    if (assigned === 'me') {
      if (officerId) {
        where.push('r.assigned_officer_id = ?')
        params.push(officerId)
      } else {
        where.push('1 = 0') // No officer profile found
      }
    } else if (assigned === 'unassigned') {
      where.push('r.assigned_officer_id IS NULL')
    } else {
      if (officerId) {
        where.push('(r.assigned_officer_id = ? OR r.assigned_officer_id IS NULL)')
        params.push(officerId)
      } else {
        where.push('r.assigned_officer_id IS NULL')
      }
    }
  } else if (role === 'admin') {
    if (assigned === 'unassigned') {
      where.push('r.assigned_officer_id IS NULL')
    } else if (assigned === 'me') {
      if (officerId) {
        where.push('r.assigned_officer_id = ?')
        params.push(officerId)
      } else {
        where.push('1 = 0')
      }
    } else if (assigned && assigned !== 'all') {
      // Direct filter by officer_id
      where.push('r.assigned_officer_id = ?')
      params.push(assigned)
    }
  }

  // 2. Status filter
  if (status && status !== 'all' && String(status).trim() !== '') {
    where.push('r.status = ?')
    params.push(String(status).toLowerCase().trim())
  }

  // 3. Priority filter
  if (priority && priority !== 'all' && String(priority).trim() !== '') {
    where.push('r.priority = ?')
    params.push(String(priority).toLowerCase().trim())
  }

  // 4. Report type filter
  const effectiveType = report_type || type
  if (effectiveType && effectiveType !== 'all' && String(effectiveType).trim() !== '') {
    where.push('r.report_type = ?')
    params.push(String(effectiveType).toLowerCase().trim())
  }

  // 5. Search text filter (q)
  const searchText = q || query
  if (searchText && String(searchText).trim() !== '') {
    const term = `%${String(searchText).trim()}%`
    where.push(`(
      r.reference_no LIKE ?
      OR r.person_name LIKE ?
      OR r.description LIKE ?
      OR r.location_city LIKE ?
    )`)
    params.push(term, term, term, term)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  // Total count for pagination
  const countSql = `
    SELECT COUNT(*) AS total
    FROM reports r
    ${whereClause}
  `
  const [countRows] = await pool.execute(countSql, params)
  const total = Number(countRows[0]?.total || 0)

  // Select query
  const selectSql = `
    SELECT ${STAFF_REPORT_FIELDS}
    FROM reports r
    LEFT JOIN officers o ON o.officer_id = r.assigned_officer_id
    LEFT JOIN users u_off ON u_off.user_id = o.user_id
    ${whereClause}
    ORDER BY r.created_at ASC
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
 * Get staff report detail by report_id including reporter contact,
 * review_note, and audit history with actor names.
 */
export async function getStaffReportById(reportId) {
  if (!reportId || !String(reportId).trim()) return null

  const [rows] = await pool.execute(
    `SELECT ${STAFF_REPORT_FIELDS}
     FROM reports r
     LEFT JOIN officers o ON o.officer_id = r.assigned_officer_id
     LEFT JOIN users u_off ON u_off.user_id = o.user_id
     WHERE r.report_id = ? LIMIT 1`,
    [String(reportId).trim()]
  )

  const report = rows[0]
  if (!report) return null

  // Fetch full report history with actor names
  const [history] = await pool.execute(
    `SELECT rh.id, rh.event, rh.actor_id, rh.created_at,
            u.name AS actor_name
     FROM report_history rh
     LEFT JOIN users u ON u.user_id = rh.actor_id
     WHERE rh.report_id = ?
     ORDER BY rh.created_at ASC, rh.id ASC`,
    [report.report_id]
  )

  report.history = history
  report.status_history = history
  return report
}

/**
 * Update report priority and log change in report_history.
 */
export async function setReportPriority(reportId, priority, actorId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [reportRows] = await connection.execute(
      'SELECT report_id, priority FROM reports WHERE report_id = ? LIMIT 1 FOR UPDATE',
      [reportId]
    )
    if (!reportRows[0]) {
      await connection.rollback()
      return null
    }

    await connection.execute(
      'UPDATE reports SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE report_id = ?',
      [priority, reportId]
    )

    await connection.execute(
      'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
      [reportId, `Priority updated to ${priority.toUpperCase()}`, actorId || null]
    )

    await connection.commit()
    return getStaffReportById(reportId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Assign report to officer with strict scoping:
 * - Officer self-assigns unassigned only
 * - Admin assigns any active officer via { officer_id } (admin without officer profile works)
 */
export async function assignReport({ reportId, callerRole, callerUserId, callerOfficerId, targetOfficerId }) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [reportRows] = await connection.execute(
      'SELECT report_id, status, assigned_officer_id FROM reports WHERE report_id = ? LIMIT 1 FOR UPDATE',
      [reportId]
    )
    const report = reportRows[0]
    if (!report) {
      await connection.rollback()
      throw new AppError('Report not found.', 404, 'NOT_FOUND')
    }

    if (!writableStatuses.includes(report.status)) {
      await connection.rollback()
      throw new AppError('Report cannot be assigned from its current status.', 409, 'CONFLICT')
    }

    let finalOfficerId
    if (callerRole === 'officer') {
      if (report.assigned_officer_id !== null) {
        await connection.rollback()
        throw new AppError('Officers can only self-assign unassigned reports.', 409, 'CONFLICT')
      }
      if (!callerOfficerId) {
        await connection.rollback()
        throw new AppError('Active officer profile not found for this user.', 403, 'FORBIDDEN')
      }
      finalOfficerId = callerOfficerId
    } else if (callerRole === 'admin') {
      if (!targetOfficerId) {
        await connection.rollback()
        throw new AppError('officer_id is required for admin assignment.', 400, 'VALIDATION_ERROR')
      }
      const [officers] = await connection.execute(
        'SELECT officer_id FROM officers WHERE officer_id = ? AND active = 1 LIMIT 1',
        [targetOfficerId]
      )
      if (!officers[0]) {
        await connection.rollback()
        throw new AppError('Target officer not found or inactive.', 404, 'NOT_FOUND')
      }
      finalOfficerId = targetOfficerId
    } else {
      await connection.rollback()
      throw new AppError('Access denied.', 403, 'FORBIDDEN')
    }

    await connection.execute(
      `UPDATE reports SET assigned_officer_id = ?, status = 'under_review', updated_at = CURRENT_TIMESTAMP
       WHERE report_id = ?`,
      [finalOfficerId, reportId]
    )

    await connection.execute(
      'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
      [reportId, 'Report assigned for review', callerUserId]
    )

    await connection.commit()

    const [rows] = await connection.execute(
      `SELECT report_id, reference_no, status, assigned_officer_id, updated_at
       FROM reports WHERE report_id = ? LIMIT 1`,
      [reportId]
    )
    return rows[0] || null
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** Backwards compatibility wrapper */
export async function assignReportToOfficer(reportId, officerUserId, actorId = officerUserId) {
  const [officers] = await pool.execute(
    'SELECT officer_id FROM officers WHERE user_id = ? AND active = 1 LIMIT 1',
    [officerUserId]
  )
  const officer = officers[0]
  if (!officer) return null

  return assignReport({
    reportId,
    callerRole: 'officer',
    callerUserId: actorId,
    callerOfficerId: officer.officer_id,
    targetOfficerId: officer.officer_id,
  })
}

async function updateReportStatus(reportId, status, reviewNote, event, actorId, callerRole = 'admin', callerOfficerId = null) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [reportRows] = await connection.execute(
      'SELECT report_id, status, assigned_officer_id FROM reports WHERE report_id = ? LIMIT 1 FOR UPDATE',
      [reportId]
    )
    const report = reportRows[0]
    if (!report) {
      await connection.rollback()
      return null
    }

    if (callerRole === 'officer' && callerOfficerId) {
      if (report.assigned_officer_id !== null && report.assigned_officer_id !== callerOfficerId) {
        await connection.rollback()
        throw new AppError("Officers cannot review reports assigned to another officer.", 403, 'FORBIDDEN')
      }
    }

    if (!writableStatuses.includes(report.status)) {
      await connection.rollback()
      return null
    }

    await connection.execute(
      `UPDATE reports SET status = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE report_id = ?`,
      [status, reviewNote, reportId]
    )

    await connection.execute(
      'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
      [reportId, event, actorId || null]
    )

    await connection.commit()

    const [rows] = await connection.execute(
      'SELECT report_id, reference_no, status, updated_at FROM reports WHERE report_id = ? LIMIT 1',
      [reportId]
    )
    return rows[0] || null
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export function requestMoreInfo(reportId, note, actorId, callerRole = 'admin', callerOfficerId = null) {
  return updateReportStatus(reportId, 'info_requested', note, 'Additional information requested', actorId, callerRole, callerOfficerId)
}

export function rejectReport(reportId, rejectionReason, actorId, callerRole = 'admin', callerOfficerId = null) {
  return updateReportStatus(reportId, 'rejected', rejectionReason, 'Report rejected', actorId, callerRole, callerOfficerId)
}

export async function approveReportAndCreateCase(reportId, caseData = {}, actorId = null, callerRole = 'admin', callerOfficerId = null) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [reportRows] = await connection.execute(
      'SELECT * FROM reports WHERE report_id = ? FOR UPDATE',
      [reportId]
    )
    const report = reportRows[0]
    if (!report) {
      await connection.rollback()
      return null
    }

    if (callerRole === 'officer' && callerOfficerId) {
      if (report.assigned_officer_id !== null && report.assigned_officer_id !== callerOfficerId) {
        await connection.rollback()
        throw new AppError("Officers cannot review reports assigned to another officer.", 403, 'FORBIDDEN')
      }
    }

    if (report.status === 'approved') {
      const error = new Error('Report is already approved')
      error.code = 'ALREADY_APPROVED'
      throw error
    }
    if (!writableStatuses.includes(report.status)) {
      const error = new Error('Report cannot be approved from its current status')
      error.code = 'INVALID_REPORT_STATUS'
      throw error
    }

    const caseId = crypto.randomUUID()
    const currentYear = new Date().getUTCFullYear()
    const crimeType = caseData.crime_type ||
      (report.report_type === 'missing' ? 'missing_person' : 'unidentified_person')
    const caseStatus = caseData.case_status || 'open'
    const kind = report.report_type
    const title = caseData.title || `${kind === 'missing' ? 'Missing' : 'Found'} person report ${report.reference_no}`
    const description = report.description
    const shortDescription = caseData.short_description || description.slice(0, 500)

    const [caseResult] = await connection.execute(
      `INSERT INTO cases (
        case_id, case_number, title, crime_type, case_status, kind, person_name,
        age, gender, event_date, short_description, description, physical_features,
        identifying_marks, height_cm, city, district, state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        caseId,
        caseId,
        title,
        crimeType,
        caseStatus,
        kind,
        report.person_name,
        report.age,
        report.gender,
        report.event_date,
        shortDescription,
        description,
        report.physical_features,
        report.identifying_marks,
        report.height_cm,
        report.location_city,
        report.location_district,
        report.location_state,
      ]
    )

    const sequence = Number(caseResult.insertId)
    const caseNumber = `IA-${currentYear}-${String(sequence).padStart(4, '0')}`
    await connection.execute(
      'UPDATE cases SET case_number = ? WHERE case_id = ?',
      [caseNumber, caseId]
    )
    await connection.execute(
      `UPDATE reports SET status = 'approved', case_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE report_id = ?`,
      [caseId, reportId]
    )
    await connection.execute(
      'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
      [reportId, 'Report approved and case created', actorId]
    )
    await connection.commit()

    const [newCaseRows] = await connection.execute(
      `SELECT case_id, case_number, title, crime_type, case_status, kind, person_name,
              age, gender, event_date, short_description, description, city, district,
              state, created_at
       FROM cases WHERE case_id = ? LIMIT 1`,
      [caseId]
    )
    return { report_id: reportId, case: newCaseRows[0] }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

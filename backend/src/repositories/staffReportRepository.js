import crypto from 'node:crypto'
import pool from '../config/database.js'

const STAFF_REPORT_FIELDS = `
  r.report_id, r.reference_no, r.report_type, r.status, r.priority,
  r.reporter_name, r.reporter_phone, r.reporter_email, r.person_name,
  r.age, r.gender, r.description, r.event_date, r.location_address,
  r.location_pincode, r.location_city, r.location_district, r.location_state,
  r.assigned_officer_id, r.created_at, r.updated_at
`

const writableStatuses = ['submitted', 'under_review', 'info_requested']

export async function getStaffReportsQueue({ status, page = 1, limit = 20 }) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)))
  const params = []
  let sql = `SELECT ${STAFF_REPORT_FIELDS} FROM reports r`

  if (status) {
    sql += ' WHERE r.status = ?'
    params.push(String(status).toLowerCase())
  }

  sql += ' ORDER BY r.created_at ASC LIMIT ? OFFSET ?'
  params.push(safeLimit, (safePage - 1) * safeLimit)
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function assignReportToOfficer(reportId, officerUserId, actorId = officerUserId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [officers] = await connection.execute(
      'SELECT officer_id FROM officers WHERE user_id = ? AND active = 1 LIMIT 1',
      [officerUserId]
    )
    if (!officers[0]) {
      await connection.rollback()
      return null
    }

    const [result] = await connection.execute(
      `UPDATE reports SET assigned_officer_id = ?, status = 'under_review'
       WHERE report_id = ? AND status IN (?, ?, ?)`,
      [officers[0].officer_id, reportId, ...writableStatuses]
    )
    if (!result.affectedRows) {
      await connection.rollback()
      return null
    }
    await connection.execute(
      'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
      [reportId, 'Report assigned for review', actorId]
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

async function updateReportStatus(reportId, status, reviewNote, event, actorId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute(
      `UPDATE reports SET status = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE report_id = ? AND status IN (?, ?, ?)`,
      [status, reviewNote, reportId, ...writableStatuses]
    )
    if (!result.affectedRows) {
      await connection.rollback()
      return null
    }
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

export function requestMoreInfo(reportId, note, actorId) {
  return updateReportStatus(reportId, 'info_requested', note, 'Additional information requested', actorId)
}

export function rejectReport(reportId, rejectionReason, actorId) {
  return updateReportStatus(reportId, 'rejected', rejectionReason, 'Report rejected', actorId)
}

export async function approveReportAndCreateCase(reportId, caseData = {}, actorId = null) {
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

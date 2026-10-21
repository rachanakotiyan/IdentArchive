import crypto from 'node:crypto'
import pool from '../config/database.js'
import { AppError } from '../utils/errors.js'

const REPORT_FIELDS = `
  report_id, reference_no, report_type, status, person_name, age, gender,
  description, event_date, location_address, location_pincode, location_city,
  location_district, location_state, created_at, updated_at
`

export async function createReport(reportData, userId) {
  if (!userId) {
    throw new AppError('Authentication required to submit a report.', 401, 'UNAUTHORIZED')
  }

  const reportId = crypto.randomUUID()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [users] = await connection.execute(
      'SELECT name, email, phone FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    )
    const reporter = users[0]
    if (!reporter) {
      throw new AppError('User account not found.', 401, 'UNAUTHORIZED')
    }

    const reportType = reportData.report_type
    const reporterName = reportData.reporter_name || reporter.name
    const reporterPhone = reportData.reporter_phone || reportData.contact_phone || reporter.phone
    const reporterEmail = reportData.reporter_email || reportData.contact_email || reporter.email
    const required = [
      reportType,
      reporterName,
      reporterPhone,
      reporterEmail,
      reportData.description,
      reportData.gender,
      reportData.event_date,
      reportData.location_address,
      reportData.location_pincode,
      reportData.location_city,
      reportData.location_district,
      reportData.location_state,
    ]
    if (required.some((value) => value === undefined || value === null || String(value).trim() === '')) {
      throw new AppError('Missing required report fields.', 400, 'VALIDATION_ERROR')
    }
    if (!['missing', 'found'].includes(reportType)) {
      throw new AppError('report_type must be missing or found.', 400, 'VALIDATION_ERROR')
    }
    if (!['male', 'female', 'other', 'unknown'].includes(reportData.gender)) {
      throw new AppError('gender is invalid.', 400, 'VALIDATION_ERROR')
    }

    const [result] = await connection.execute(
      `INSERT INTO reports (
        report_id, reference_no, report_type, reporter_id, reporter_name,
        reporter_phone, reporter_email, description, person_name, age, gender,
        height_cm, physical_features, identifying_marks, event_date,
        location_address, location_pincode, location_city, location_district,
        location_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        reportId,
        reportId,
        reportType,
        userId,
        reporterName,
        reporterPhone,
        reporterEmail,
        reportData.description,
        reportData.person_name || reportData.subject_name || null,
        reportData.age ?? null,
        reportData.gender,
        reportData.height_cm ?? null,
        reportData.physical_features || null,
        reportData.identifying_marks || null,
        reportData.event_date,
        reportData.location_address,
        reportData.location_pincode,
        reportData.location_city,
        reportData.location_district,
        reportData.location_state,
      ]
    )

    const sequence = Number(result.insertId)
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    const referenceNo = `REF-${date}-${String(sequence).padStart(6, '0')}`
    await connection.execute(
      'UPDATE reports SET reference_no = ? WHERE report_id = ?',
      [referenceNo, reportId]
    )
    await connection.execute(
      'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
      [reportId, 'Report submitted', userId]
    )
    await connection.commit()

    const [rows] = await connection.execute(
      `SELECT ${REPORT_FIELDS} FROM reports WHERE report_id = ? LIMIT 1`,
      [reportId]
    )
    return rows[0]
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getReportsByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT ${REPORT_FIELDS} FROM reports
     WHERE reporter_id = ? ORDER BY created_at DESC`,
    [userId]
  )
  return rows
}

export async function getReportByRefAndEmail(referenceNo, email) {
  const [rows] = await pool.execute(
    `SELECT reference_no, report_type, status, person_name, age, gender,
            description, event_date, location_city, location_district, location_state,
            created_at, updated_at
     FROM reports WHERE reference_no = ? AND reporter_email = ? LIMIT 1`,
    [referenceNo, String(email).trim().toLowerCase()]
  )
  return rows[0] || null
}

import pool from '../config/database.js'
import { AppError } from '../utils/errors.js'

/**
 * Look up a single pincode row by the 6-digit code.
 * Returns the first row when multiple rows share the same pincode (stable: ordered by pincode).
 *
 * @param {string} pincode  - 6-digit pincode string
 * @param {import('mysql2/promise').Connection|null} [conn=null]
 * @returns {Promise<{ pincode: string, city: string, district: string, state: string }|null>}
 */
export async function getPincodeInfo(pincode, conn = null) {
  if (!pincode || !/^\d{6}$/.test(String(pincode))) {
    return null
  }
  const executor = conn || pool
  const [rows] = await executor.execute(
    'SELECT pincode, city, district, state FROM pincodes WHERE pincode = ? ORDER BY pincode ASC LIMIT 1',
    [String(pincode)]
  )
  return rows[0] || null
}

/**
 * Derive city/district/state from the pincodes table.
 * Throws an AppError(400) if the pincode does not exist or is invalid format.
 *
 * @param {string} pincode
 * @param {import('mysql2/promise').Connection|null} [conn=null]
 * @returns {Promise<{ city: string, district: string, state: string }>}
 */
export async function derivePincodeLocation(pincode, conn = null) {
  const row = await getPincodeInfo(pincode, conn)
  if (!row) {
    throw new AppError(
      `Pincode ${pincode} does not exist in the pincodes table.`,
      400,
      'VALIDATION_ERROR',
      [{ field: 'location_pincode', message: 'Pincode not found.' }]
    )
  }
  return { city: row.city, district: row.district, state: row.state }
}

/**
 * Compute public aggregate statistics from MySQL.
 *
 * @returns {Promise<{ activeCases: number, underReview: number, resolvedCases: number, reportsThisWeek: number }>}
 */
export async function getPublicStats() {
  const [[activeCasesRow]] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM cases WHERE case_status = 'open'"
  )
  const [[underReviewRow]] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM cases WHERE case_status = 'under_review'"
  )
  const [[resolvedRow]] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM cases WHERE case_status = 'resolved'"
  )
  const [[reportsWeekRow]] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM reports WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)'
  )

  return {
    activeCases: Number(activeCasesRow.cnt),
    underReview: Number(underReviewRow.cnt),
    resolvedCases: Number(resolvedRow.cnt),
    reportsThisWeek: Number(reportsWeekRow.cnt),
  }
}

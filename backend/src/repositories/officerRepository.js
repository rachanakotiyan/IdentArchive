import pool from '../config/database.js'

/**
 * Find an officer row by user_id.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function findByUserId(userId) {
  const [rows] = await pool.execute(
    'SELECT officer_id, user_id, badge, district, active FROM officers WHERE user_id = ? LIMIT 1',
    [userId]
  )
  return rows[0] || null
}

/**
 * Insert a new officer row. Runs inside a given connection (to support transactions).
 *
 * @param {object} data
 * @param {string} data.officerId
 * @param {string} data.userId
 * @param {string} data.badge
 * @param {string} data.district
 * @param {import('mysql2/promise').Connection} conn
 * @returns {Promise<object>}
 */
export async function create({ officerId, userId, badge, district }, conn) {
  await conn.execute(
    `INSERT INTO officers (officer_id, user_id, badge, district, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [officerId, userId, badge, district]
  )
  const [rows] = await conn.execute(
    'SELECT officer_id, user_id, badge, district, active FROM officers WHERE officer_id = ? LIMIT 1',
    [officerId]
  )
  return rows[0]
}

/**
 * Find an officer row by officer_id.
 *
 * @param {string} officerId
 * @returns {Promise<object|null>}
 */
export async function findById(officerId) {
  const [rows] = await pool.execute(
    `SELECT o.officer_id, o.user_id, o.badge, o.district, o.active,
            u.name, u.email
     FROM officers o
     JOIN users u ON u.user_id = o.user_id
     WHERE o.officer_id = ? LIMIT 1`,
    [officerId]
  )
  return rows[0] || null
}

/**
 * List officers with name, email, badge, district, active, and workload.
 * Workload is the number of active reports/cases currently assigned to the officer.
 *
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.q]
 * @returns {Promise<Array<object>&{ total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listOfficersWithWorkload({ page = 1, limit = 20, q = '' } = {}) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)))
  const offset = (safePage - 1) * safeLimit

  const where = []
  const params = []

  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`
    where.push('(u.name LIKE ? OR u.email LIKE ? OR o.badge LIKE ? OR o.district LIKE ?)')
    params.push(term, term, term, term)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  // Total count
  const countSql = `
    SELECT COUNT(*) AS total
    FROM officers o
    JOIN users u ON u.user_id = o.user_id
    ${whereClause}
  `
  const [countRows] = await pool.execute(countSql, params)
  const total = Number(countRows[0]?.total || 0)

  // Query with workload count
  const selectSql = `
    SELECT o.officer_id, o.user_id, o.badge, o.district, o.active,
           u.name, u.email,
           COUNT(DISTINCT r.report_id) AS workload
    FROM officers o
    JOIN users u ON u.user_id = o.user_id
    LEFT JOIN reports r ON r.assigned_officer_id = o.officer_id
      AND r.status IN ('submitted', 'under_review', 'info_requested')
    ${whereClause}
    GROUP BY o.officer_id, o.user_id, o.badge, o.district, o.active, u.name, u.email
    ORDER BY u.name ASC
    LIMIT ? OFFSET ?
  `
  const [rows] = await pool.execute(selectSql, [...params, safeLimit, offset])

  const formatted = rows.map((row) => ({
    officer_id: row.officer_id,
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    badge: row.badge,
    district: row.district,
    active: Boolean(row.active),
    workload: Number(row.workload || 0),
  }))

  formatted.total = total
  formatted.page = safePage
  formatted.limit = safeLimit
  formatted.totalPages = Math.ceil(total / safeLimit) || 1

  return formatted
}

/**
 * Set officer.active = 0|1.
 *
 * @param {string} officerId
 * @param {0|1} active
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function setActive(officerId, active) {
  const [result] = await pool.execute(
    'UPDATE officers SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE officer_id = ?',
    [active, officerId]
  )
  return result.affectedRows > 0
}

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

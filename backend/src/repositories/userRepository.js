import pool from '../config/database.js'

/**
 * Shared column list that NEVER includes password_hash.
 * Used on every query that returns a user to the caller.
 */
const PUBLIC_COLS = 'user_id, name, email, role, phone, verified_at, created_at, updated_at'

/**
 * Find a user by primary key. Returns public fields (no password_hash).
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function findById(userId) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLS} FROM users WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  return rows[0] || null
}

/**
 * Find a user by email (case-insensitive). Returns public fields (no password_hash).
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export async function findByEmail(email) {
  const normalised = email.toLowerCase().trim()
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLS} FROM users WHERE email = ? LIMIT 1`,
    [normalised]
  )
  return rows[0] || null
}

/**
 * Find a user by email including password_hash – ONLY used by the login flow.
 * Never expose the result directly to HTTP callers.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export async function findByEmailWithHash(email) {
  const normalised = email.toLowerCase().trim()
  const [rows] = await pool.execute(
    `SELECT user_id, name, email, role, phone, verified_at, created_at, updated_at, password_hash
     FROM users WHERE email = ? LIMIT 1`,
    [normalised]
  )
  return rows[0] || null
}

/**
 * Return true if any user with role='admin' already exists.
 *
 * @returns {Promise<boolean>}
 */
export async function adminExists(conn = null) {
  const db = conn || pool
  const [rows] = await db.execute(
    'SELECT 1 FROM users WHERE role = ? LIMIT 1',
    ['admin']
  )
  return rows.length > 0
}

/**
 * Return true if the given email is already taken (case-insensitive).
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function emailExists(email, conn = null) {
  const normalised = email.toLowerCase().trim()
  const db = conn || pool
  const [rows] = await db.execute(
    'SELECT 1 FROM users WHERE email = ? LIMIT 1',
    [normalised]
  )
  return rows.length > 0
}

/**
 * List all users with pagination and optional search filter.
 * NEVER selects or returns password_hash.
 *
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.q]
 * @param {string} [options.role]
 * @returns {Promise<Array<object>&{ total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listUsers({ page = 1, limit = 20, q = '', role = '' } = {}) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)))
  const offset = (safePage - 1) * safeLimit

  const where = []
  const params = []

  if (role && ['individual', 'officer', 'admin'].includes(role.toLowerCase().trim())) {
    where.push('role = ?')
    params.push(role.toLowerCase().trim())
  }

  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)')
    params.push(term, term, term)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const countSql = `SELECT COUNT(*) AS total FROM users ${whereClause}`
  const [countRows] = await pool.execute(countSql, params)
  const total = Number(countRows[0]?.total || 0)

  const selectSql = `
    SELECT ${PUBLIC_COLS}
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `
  const [rows] = await pool.execute(selectSql, [...params, safeLimit, offset])

  rows.total = total
  rows.page = safePage
  rows.limit = safeLimit
  rows.totalPages = Math.ceil(total / safeLimit) || 1

  return rows
}

/**
 * List officer and admin accounts without selecting password hashes.
 *
 * @returns {Promise<Array<object>>}
 */
export async function listStaff() {
  const [rows] = await pool.execute(
    `SELECT u.user_id, u.name, u.email, u.role, u.phone,
            o.officer_id, o.badge, o.district, o.active,
            u.created_at, u.updated_at
     FROM users u
     LEFT JOIN officers o ON o.user_id = u.user_id
     WHERE u.role IN (?, ?)
     ORDER BY u.created_at DESC`,
    ['officer', 'admin']
  )
  return rows
}

/**
 * Insert a new user row. Returns public fields (no password_hash).
 *
 * @param {object} data
 * @param {string} data.userId       - UUID
 * @param {string} data.name
 * @param {string} data.email        - will be lowercased/trimmed
 * @param {string} data.passwordHash - bcrypt hash
 * @param {'individual'|'officer'|'admin'} data.role
 * @param {string|null} [data.phone]
 * @param {Date|null}   [data.verifiedAt]
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} [conn]
 *   Pass an existing connection to run inside a transaction.
 * @returns {Promise<object>}
 */
export async function create({ userId, name, email, passwordHash, role, phone = null, verifiedAt = null }, conn = null) {
  const normalised = email.toLowerCase().trim()
  const db = conn || pool
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, phone, verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [userId, name, normalised, passwordHash, role, phone, verifiedAt]
  )
  // Re-fetch without password_hash
  const [rows] = await db.execute(
    `SELECT ${PUBLIC_COLS} FROM users WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  return rows[0]
}

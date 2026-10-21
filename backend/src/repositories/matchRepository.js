import pool from '../config/database.js'
import { AppError } from '../utils/errors.js'

/**
 * Columns selected for a match row, joining both related case summaries.
 * Reporter details, review notes, and internal officer fields are never included.
 */
const MATCH_FIELDS = `
  m.match_id,
  m.missing_case_id,
  m.found_case_id,
  m.similarity_score,
  m.status,
  m.created_at,
  m.updated_at,
  mc.case_number  AS missing_case_number,
  mc.title        AS missing_case_title,
  mc.person_name  AS missing_person_name,
  mc.age          AS missing_age,
  mc.gender       AS missing_gender,
  mc.city         AS missing_city,
  mc.district     AS missing_district,
  mc.state        AS missing_state,
  mc.event_date   AS missing_event_date,
  fc.case_number  AS found_case_number,
  fc.title        AS found_case_title,
  fc.person_name  AS found_person_name,
  fc.age          AS found_age,
  fc.gender       AS found_gender,
  fc.city         AS found_city,
  fc.district     AS found_district,
  fc.state        AS found_state,
  fc.event_date   AS found_event_date
`

const MATCH_JOINS = `
  FROM matches m
  JOIN cases mc ON mc.case_id = m.missing_case_id
  JOIN cases fc ON fc.case_id = m.found_case_id
`

/** Valid status values for the matches.status ENUM */
const VALID_STATUSES = Object.freeze(['pending', 'confirmed', 'dismissed'])

/** Valid action values an officer can take when verifying a match */
const VALID_ACTIONS = Object.freeze(['confirmed', 'dismissed'])

/**
 * Paginated list of matches, optionally filtered by status.
 * Results are ordered oldest-first so reviewers work through the queue in FIFO order.
 *
 * @param {object} [opts={}]
 * @param {string} [opts.status]     - Filter by matches.status ('pending'|'confirmed'|'dismissed')
 * @param {number} [opts.page=1]     - 1-based page number
 * @param {number} [opts.limit=20]   - Page size (capped at 100)
 * @returns {Promise<object[]>}      - Array of enriched match rows
 */
export async function getMatchesQueue({ status, page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)))
  const offset = (safePage - 1) * safeLimit

  const params = []
  let where = ''

  if (status !== undefined && status !== null && String(status).trim() !== '') {
    const normStatus = String(status).trim().toLowerCase()
    if (!VALID_STATUSES.includes(normStatus)) {
      throw new AppError(
        `Invalid status value "${normStatus}". Must be one of: ${VALID_STATUSES.join(', ')}.`,
        400,
        'VALIDATION_ERROR'
      )
    }
    where = 'WHERE m.status = ?'
    params.push(normStatus)
  }

  const sql = `
    SELECT ${MATCH_FIELDS}
    ${MATCH_JOINS}
    ${where}
    ORDER BY m.created_at ASC
    LIMIT ? OFFSET ?
  `
  params.push(safeLimit, offset)
  const [rows] = await pool.execute(sql, params)
  return rows
}

/**
 * Retrieve a single match (with both case summaries) by its UUID.
 * Also fetches the most recent verification record if one exists.
 *
 * @param {string} matchId
 * @returns {Promise<object|null>}
 */
export async function getMatchById(matchId) {
  if (!matchId || String(matchId).trim() === '') {
    return null
  }

  const [rows] = await pool.execute(
    `SELECT ${MATCH_FIELDS}
     ${MATCH_JOINS}
     WHERE m.match_id = ?
     LIMIT 1`,
    [String(matchId).trim()]
  )

  const match = rows[0] || null
  if (!match) {
    return null
  }

  // Fetch the latest verification record for this match (if any)
  const [verRows] = await pool.execute(
    `SELECT
       mv.id,
       mv.match_id,
       mv.officer_id,
       mv.decision,
       mv.remarks,
       mv.verification_date,
       o.badge   AS officer_badge,
       u.name    AS officer_name
     FROM match_verifications mv
     JOIN officers o ON o.officer_id = mv.officer_id
     JOIN users u    ON u.user_id    = o.user_id
     WHERE mv.match_id = ?
     ORDER BY mv.verification_date DESC
     LIMIT 1`,
    [match.match_id]
  )

  match.latest_verification = verRows[0] || null
  return match
}

/**
 * Record an officer's verification decision on a match, updating the match status atomically.
 *
 * The function:
 *  1. Looks up the active officer profile for the given `officerUserId`.
 *  2. Validates that the match exists and is in a state that allows verification.
 *  3. Inserts a row into `match_verifications`.
 *  4. Updates `matches.status` to the action decision.
 * All steps run inside a single database transaction that is rolled back on any error.
 *
 * @param {string} matchId         - UUID of the match to verify
 * @param {string} officerUserId   - `users.user_id` of the reviewing officer
 * @param {'confirmed'|'dismissed'} action - Verification decision
 * @param {string} [notes='']      - Officer remarks (stored as verification notes/remarks)
 * @returns {Promise<object>}      - Updated match row with the new verification attached
 * @throws {AppError}              - 400 on invalid inputs, 404 if not found, 409 if already decided
 */
export async function verifyMatch(matchId, officerUserId, action, notes = '') {
  // --- Input validation (before touching the DB) ---
  if (!matchId || String(matchId).trim() === '') {
    throw new AppError('matchId is required.', 400, 'VALIDATION_ERROR')
  }
  if (!officerUserId || String(officerUserId).trim() === '') {
    throw new AppError('officerUserId is required.', 400, 'VALIDATION_ERROR')
  }
  const normAction = typeof action === 'string' ? action.trim().toLowerCase() : ''
  if (!VALID_ACTIONS.includes(normAction)) {
    throw new AppError(
      `Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}.`,
      400,
      'VALIDATION_ERROR'
    )
  }
  const remarks = typeof notes === 'string' ? notes.trim() : String(notes ?? '').trim()
  if (!remarks) {
    throw new AppError('Notes/remarks are required for a verification decision.', 400, 'VALIDATION_ERROR')
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // 1. Resolve the officer profile from the authenticated user_id
    const [officerRows] = await connection.execute(
      'SELECT officer_id FROM officers WHERE user_id = ? AND active = 1 LIMIT 1',
      [String(officerUserId).trim()]
    )
    const officer = officerRows[0]
    if (!officer) {
      throw new AppError(
        'Active officer profile not found for this user.',
        403,
        'FORBIDDEN'
      )
    }
    const { officer_id } = officer

    // 2. Lock and validate the match row
    const [matchRows] = await connection.execute(
      'SELECT match_id, status FROM matches WHERE match_id = ? LIMIT 1 FOR UPDATE',
      [String(matchId).trim()]
    )
    const match = matchRows[0]
    if (!match) {
      throw new AppError('Match not found.', 404, 'NOT_FOUND')
    }
    if (match.status !== 'pending') {
      throw new AppError(
        `Match has already been decided (current status: "${match.status}"). Only pending matches can be verified.`,
        409,
        'CONFLICT'
      )
    }

    // 3. Insert verification record into match_verifications
    await connection.execute(
      `INSERT INTO match_verifications (match_id, officer_id, decision, remarks, verification_date)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [match.match_id, officer_id, normAction, remarks]
    )

    // 4. Update matches.status to reflect the decision
    await connection.execute(
      'UPDATE matches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE match_id = ?',
      [normAction, match.match_id]
    )

    await connection.commit()

    // Return the fully enriched match row (uses pool, outside transaction)
    const updated = await getMatchById(match.match_id)
    return updated
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

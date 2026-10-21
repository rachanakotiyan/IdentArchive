import crypto from 'node:crypto'
import mysql from 'mysql2/promise'
import 'dotenv/config'
import { runMigrations, sanitizeOutput } from '../../scripts/migrate.js'

export const DEFAULT_TEST_DB = 'identarchive_test'

export const APP_TABLES = Object.freeze([
  'match_verifications',
  'matches',
  'report_history',
  'reports',
  'case_updates',
  'cases',
  'pincodes',
  'officers',
  'users',
])

/**
 * Validates the test database name to prevent accidental execution on production/dev DBs.
 *
 * @param {string} dbName
 */
export function validateTestDbName(dbName) {
  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${dbName}": DB_TEST_NAME must end with "_test" to protect data.`
    )
  }
}

/**
 * Creates and returns a direct connection to the test database.
 *
 * @param {string} [database]
 * @returns {Promise<mysql.Connection>}
 */
export async function createTestDbConnection(database) {
  const targetDb = database || process.env.DB_TEST_NAME || DEFAULT_TEST_DB
  validateTestDbName(targetDb)

  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT) || 3306
  const user = process.env.DB_MIGRATE_USER || process.env.DB_USER || 'identarchive_migrate'
  const password = process.env.DB_MIGRATE_PASSWORD ?? process.env.DB_PASSWORD ?? ''

  return mysql.createConnection({
    host,
    port,
    user,
    password,
    database: targetDb,
    multipleStatements: true,
    timezone: 'Z',
    charset: 'utf8mb4',
  })
}

/**
 * Ensures migrations are applied to the test database.
 *
 * @param {string} [database]
 */
export async function applyTestMigrations(database) {
  const targetDb = database || process.env.DB_TEST_NAME || DEFAULT_TEST_DB
  validateTestDbName(targetDb)
  await runMigrations({ dbOverride: targetDb, silent: true })
}

/**
 * Truncates application tables between test runs.
 * Note: Foreign key checks are disabled strictly within this helper.
 *
 * @param {mysql.Connection} connection
 */
export async function truncateTables(connection) {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0')
  try {
    for (const table of APP_TABLES) {
      await connection.query(`TRUNCATE TABLE \`${table}\``)
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
  }
}

/**
 * Checks if the test database is reachable and ready.
 *
 * @returns {Promise<{ ok: boolean, connection?: mysql.Connection, reason?: string }>}
 */
export async function checkTestDbReadiness() {
  const testDb = process.env.DB_TEST_NAME || DEFAULT_TEST_DB
  try {
    validateTestDbName(testDb)
    const conn = await createTestDbConnection(testDb)
    await applyTestMigrations(testDb)
    return { ok: true, connection: conn }
  } catch (err) {
    const safeMsg = sanitizeOutput(err)
    return {
      ok: false,
      reason: `Test database "${testDb}" unreachable or unavailable: ${safeMsg} [${err.code || 'UNKNOWN'}]`,
    }
  }
}

// ---------------------------------------------------------------------------
// Entity Creation Helpers (generates valid test data rows)
// ---------------------------------------------------------------------------

export async function createUser(conn, overrides = {}) {
  const user_id = overrides.userId || crypto.randomUUID()
  const name = overrides.name || 'Test User'
  const email = overrides.email || `user-${crypto.randomUUID()}@identarchive.test`
  const password_hash = overrides.passwordHash || '$2a$12$placeholderhashforconstrainttesting00000000000000000000'
  const role = overrides.role || 'individual'
  const phone = overrides.phone || '9876543210'

  await conn.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [user_id, name, email, password_hash, role, phone]
  )

  return { user_id, name, email, role }
}

export async function createOfficer(conn, overrides = {}) {
  const officer_id = overrides.officerId || crypto.randomUUID()
  const user_id = overrides.userId
  const badge = overrides.badge || `B-${crypto.randomUUID().slice(0, 8)}`
  const district = overrides.district || 'Central District'
  const active = overrides.active !== undefined ? overrides.active : 1

  await conn.execute(
    `INSERT INTO officers (officer_id, user_id, badge, district, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [officer_id, user_id, badge, district, active]
  )

  return { officer_id, user_id, badge, district, active }
}

export async function createCase(conn, overrides = {}) {
  const case_id = overrides.caseId || crypto.randomUUID()
  const case_number = overrides.caseNumber || `IA-2026-${crypto.randomUUID().slice(0, 8)}`
  const title = overrides.title || 'Case Title'
  const crime_type = overrides.crimeType || 'missing_person'
  const case_status = overrides.caseStatus || 'open'
  const kind = overrides.kind || 'missing'
  const gender = overrides.gender || 'unknown'
  const event_date = overrides.eventDate || '2026-01-01'
  const short_description = overrides.shortDescription || 'Short description'
  const description = overrides.description || 'Detailed narrative for case.'
  const city = overrides.city || 'Bangalore'
  const district = overrides.district || 'Bangalore Urban'
  const state = overrides.state || 'Karnataka'
  const age = overrides.age !== undefined ? overrides.age : 30
  const height_cm = overrides.heightCm !== undefined ? overrides.heightCm : 170

  await conn.execute(
    `INSERT INTO cases (
      case_id, case_number, title, crime_type, case_status, kind,
      gender, event_date, short_description, description,
      city, district, state, age, height_cm, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      case_id,
      case_number,
      title,
      crime_type,
      case_status,
      kind,
      gender,
      event_date,
      short_description,
      description,
      city,
      district,
      state,
      age,
      height_cm,
    ]
  )

  return { case_id, case_number, kind, age, height_cm }
}

export async function createReport(conn, overrides = {}) {
  const report_id = overrides.reportId || crypto.randomUUID()
  const reference_no = overrides.referenceNo || `REF-${crypto.randomUUID().slice(0, 8)}`
  const report_type = overrides.reportType || 'missing'
  const reporter_id = overrides.reporterId
  const reporter_name = overrides.reporterName || 'Reporter Person'
  const reporter_phone = overrides.reporterPhone || '9876543210'
  const reporter_email = overrides.reporterEmail || 'reporter@identarchive.test'
  const gender = overrides.gender || 'unknown'
  const description = overrides.description || 'Report case details'
  const event_date = overrides.eventDate || '2026-01-01'
  const location_address = overrides.locationAddress || '10 MG Road'
  const location_pincode = overrides.locationPincode || '560001'
  const location_city = overrides.locationCity || 'Bangalore'
  const location_district = overrides.locationDistrict || 'Bangalore Urban'
  const location_state = overrides.locationState || 'Karnataka'
  const case_id = overrides.caseId !== undefined ? overrides.caseId : null

  await conn.execute(
    `INSERT INTO reports (
      report_id, reference_no, report_type, reporter_id, reporter_name,
      reporter_phone, reporter_email, gender, description, event_date,
      location_address, location_pincode, location_city, location_district,
      location_state, case_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      report_id,
      reference_no,
      report_type,
      reporter_id,
      reporter_name,
      reporter_phone,
      reporter_email,
      gender,
      description,
      event_date,
      location_address,
      location_pincode,
      location_city,
      location_district,
      location_state,
      case_id,
    ]
  )

  return { report_id, reference_no, case_id }
}

export async function createMatch(conn, overrides = {}) {
  const match_id = overrides.matchId || crypto.randomUUID()
  const missing_case_id = overrides.missingCaseId
  const missing_kind = overrides.missingKind || 'missing'
  const found_case_id = overrides.foundCaseId
  const found_kind = overrides.foundKind || 'found'
  const similarity_score = overrides.similarityScore !== undefined ? overrides.similarityScore : 0.85
  const status = overrides.status || 'pending'

  await conn.execute(
    `INSERT INTO matches (
      match_id, missing_case_id, missing_kind, found_case_id, found_kind,
      similarity_score, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [match_id, missing_case_id, missing_kind, found_case_id, found_kind, similarity_score, status]
  )

  return { match_id, missing_case_id, found_case_id, similarity_score, status }
}

export async function createVerification(conn, overrides = {}) {
  const match_id = overrides.matchId
  const officer_id = overrides.officerId
  const decision = overrides.decision || 'confirmed'
  const remarks = overrides.remarks || 'Verification confirmed by officer.'

  const [result] = await conn.execute(
    `INSERT INTO match_verifications (match_id, officer_id, decision, remarks, verification_date)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [match_id, officer_id, decision, remarks]
  )

  return { id: result.insertId, match_id, officer_id, decision }
}

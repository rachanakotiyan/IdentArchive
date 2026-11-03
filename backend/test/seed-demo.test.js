import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkTestDbReadiness,
  DEFAULT_TEST_DB,
  truncateTables,
  validateTestDbName,
} from './helpers/test-db.js'
import {
  DEFAULT_FALLBACK_PINCODES,
  removeDemo,
  seedDemo,
} from '../scripts/seed-demo.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_DIR = path.resolve(__dirname, '..')

const testDbName = process.env.DB_TEST_NAME || DEFAULT_TEST_DB
validateTestDbName(testDbName)
const readiness = await checkTestDbReadiness()
const skipReason = readiness.ok ? false : (readiness.reason || 'Test database unreachable')

describe('Demo Seeder & Safety Unit Tests', () => {
  const testManifestPath = path.join(BACKEND_DIR, 'unit-demo-manifest.json')
  const testCredentialsPath = path.join(BACKEND_DIR, 'unit-demo-credentials.csv')

  beforeEach(() => {
    if (fs.existsSync(testManifestPath)) fs.unlinkSync(testManifestPath)
    if (fs.existsSync(testCredentialsPath)) fs.unlinkSync(testCredentialsPath)
  })

  after(() => {
    if (fs.existsSync(testManifestPath)) fs.unlinkSync(testManifestPath)
    if (fs.existsSync(testCredentialsPath)) fs.unlinkSync(testCredentialsPath)
  })

  it('refuses execution when DEMO_PASSWORD is less than 12 characters', async () => {
    await assert.rejects(
      seedDemo({
        manifestPath: testManifestPath,
        credentialsPath: testCredentialsPath,
        demoPassword: 'short',
        silent: true,
      }),
      /at least 12 characters/i
    )
  })

  it('refuses execution in NODE_ENV=production unless --allow-production', async () => {
    const originalEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'production'
      await assert.rejects(
        seedDemo({
          manifestPath: testManifestPath,
          credentialsPath: testCredentialsPath,
          allowProduction: false,
          silent: true,
        }),
        /production/i
      )
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })

  it('refuses double-seeding if manifest already exists unless --force is set', async () => {
    fs.writeFileSync(testManifestPath, JSON.stringify({ seededAt: new Date().toISOString() }))
    await assert.rejects(
      seedDemo({
        manifestPath: testManifestPath,
        credentialsPath: testCredentialsPath,
        force: false,
        silent: true,
      }),
      /already exists/i
    )
  })

  it('refuses removeDemo if manifest does not exist', async () => {
    await assert.rejects(
      removeDemo({
        manifestPath: testManifestPath,
        credentialsPath: testCredentialsPath,
        silent: true,
      }),
      /manifest not found/i
    )
  })

  it('full seeding flow and data validation using in-memory mock connection', async () => {
    const dbState = {
      users: [],
      officers: [],
      cases: [],
      case_updates: [],
      reports: [],
      report_history: [],
      matches: [],
      match_verifications: [],
    }

    let insertSeq = 100

    const mockConnection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      execute: async (sql, params = []) => {
        const trimmed = sql.trim().toUpperCase()
        if (trimmed.startsWith('INSERT INTO USERS')) {
          const role = sql.includes("'officer'") ? 'officer' : 'individual'
          dbState.users.push({
            user_id: params[0],
            name: params[1],
            email: params[2],
            password_hash: params[3],
            role,
            phone: params[4],
          })
          return [{ insertId: ++insertSeq }]
        }
        if (trimmed.startsWith('INSERT INTO OFFICERS')) {
          dbState.officers.push({
            officer_id: params[0],
            user_id: params[1],
            badge: params[2],
            district: params[3],
            active: params[4],
          })
          return [{ insertId: ++insertSeq }]
        }
        if (trimmed.startsWith('INSERT INTO CASES')) {
          const caseRecord = {
            case_id: params[0],
            case_number: params[1],
            title: params[2],
            crime_type: params[3],
            case_status: params[4],
            kind: params[5],
            person_name: params[6],
            age: params[7],
            estimated_age: params[8],
            gender: params[9],
            event_date: params[10],
          }
          dbState.cases.push(caseRecord)
          return [{ insertId: ++insertSeq }]
        }
        if (trimmed.startsWith('UPDATE CASES SET CASE_NUMBER')) {
          const c = dbState.cases.find((item) => item.case_id === params[1])
          if (c) c.case_number = params[0]
          return [{ affectedRows: 1 }]
        }
        if (trimmed.startsWith('INSERT INTO CASE_UPDATES')) {
          dbState.case_updates.push({
            id: ++insertSeq,
            case_id: params[0],
            update_date: params[1],
            note: params[2],
          })
          return [{ insertId: insertSeq }]
        }
        if (trimmed.startsWith('INSERT INTO REPORTS')) {
          const reportRecord = {
            report_id: params[0],
            reference_no: params[1],
            report_type: params[2],
            status: params[3],
            priority: params[4],
            reporter_id: params[5],
            assigned_officer_id: params[9],
            case_id: params[10],
            description: params[11],
            person_name: params[12],
            review_note: params[22],
          }
          dbState.reports.push(reportRecord)
          return [{ insertId: ++insertSeq }]
        }
        if (trimmed.startsWith('UPDATE REPORTS SET REFERENCE_NO')) {
          const r = dbState.reports.find((item) => item.report_id === params[1])
          if (r) r.reference_no = params[0]
          return [{ affectedRows: 1 }]
        }
        if (trimmed.startsWith('INSERT INTO REPORT_HISTORY')) {
          dbState.report_history.push({
            id: ++insertSeq,
            report_id: params[0],
            event: params[1],
            actor_id: params[2],
          })
          return [{ insertId: insertSeq }]
        }
        if (trimmed.startsWith('INSERT INTO MATCHES')) {
          dbState.matches.push({
            match_id: params[0],
            missing_case_id: params[1],
            missing_kind: 'missing',
            found_case_id: params[2],
            found_kind: 'found',
            similarity_score: params[3],
            status: params[4],
          })
          return [{ insertId: ++insertSeq }]
        }
        if (trimmed.startsWith('INSERT INTO MATCH_VERIFICATIONS')) {
          dbState.match_verifications.push({
            id: ++insertSeq,
            match_id: params[0],
            officer_id: params[1],
            decision: params[2],
            remarks: params[3],
          })
          return [{ insertId: insertSeq }]
        }
        return [{ insertId: ++insertSeq }]
      },
      query: async (sql, params = []) => {
        const trimmed = sql.trim().toUpperCase()
        if (trimmed.startsWith('SELECT PINCODE')) {
          return [DEFAULT_FALLBACK_PINCODES]
        }
        if (trimmed.startsWith('DELETE FROM MATCH_VERIFICATIONS')) {
          const ids = new Set(params[0])
          dbState.match_verifications = dbState.match_verifications.filter((v) => !ids.has(v.id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('DELETE FROM MATCHES')) {
          const ids = new Set(params[0])
          dbState.matches = dbState.matches.filter((m) => !ids.has(m.match_id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('DELETE FROM REPORT_HISTORY')) {
          const ids = new Set(params[0])
          dbState.report_history = dbState.report_history.filter((h) => !ids.has(h.id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('UPDATE REPORTS SET CASE_ID = NULL')) {
          return [{ affectedRows: dbState.reports.length }]
        }
        if (trimmed.startsWith('DELETE FROM REPORTS')) {
          const ids = new Set(params[0])
          dbState.reports = dbState.reports.filter((r) => !ids.has(r.report_id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('DELETE FROM CASE_UPDATES')) {
          const ids = new Set(params[0])
          dbState.case_updates = dbState.case_updates.filter((u) => !ids.has(u.id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('DELETE FROM CASES')) {
          const ids = new Set(params[0])
          dbState.cases = dbState.cases.filter((c) => !ids.has(c.case_id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('DELETE FROM OFFICERS')) {
          const ids = new Set(params[0])
          dbState.officers = dbState.officers.filter((o) => !ids.has(o.officer_id))
          return [{ affectedRows: ids.size }]
        }
        if (trimmed.startsWith('DELETE FROM USERS')) {
          const ids = new Set(params[0])
          dbState.users = dbState.users.filter((u) => !ids.has(u.user_id))
          return [{ affectedRows: ids.size }]
        }
        return [[]]
      },
    }

    // 1. Seed demo data
    const result = await seedDemo({
      connection: mockConnection,
      manifestPath: testManifestPath,
      credentialsPath: testCredentialsPath,
      silent: true,
      demoPassword: 'MockSecretPassword123!',
    })

    assert.equal(result.success, true)
    assert.equal(fs.existsSync(testManifestPath), true)
    assert.equal(fs.existsSync(testCredentialsPath), true)

    // Verify 7 Officers
    assert.equal(dbState.officers.length, 7, 'Must have 7 officers')
    const badges = dbState.officers.map((o) => o.badge).sort()
    assert.deepEqual(badges, [
      'DEMO-001',
      'DEMO-002',
      'DEMO-003',
      'DEMO-004',
      'DEMO-005',
      'DEMO-006',
      'DEMO-007',
    ])
    const activeCount = dbState.officers.filter((o) => o.active === 1).length
    const inactiveCount = dbState.officers.filter((o) => o.active === 0).length
    assert.equal(activeCount, 6, 'Must have 6 active officers')
    assert.equal(inactiveCount, 1, 'Must have 1 inactive officer')

    // Verify 20 Individual Users
    const individualUsers = dbState.users.filter((u) => u.role === 'individual')
    assert.equal(individualUsers.length, 20, 'Must have 20 individual users')
    for (const u of individualUsers) {
      assert.match(u.email, /^[a-z]+\.[a-z]+@demo\.identarchive\.example$/)
      assert.match(u.phone, /^\+91-00000-000\d{2}$/)
    }

    // Verify 10 Cases
    assert.equal(dbState.cases.length, 10, 'Must have 10 cases')
    const caseStatuses = new Set(dbState.cases.map((c) => c.case_status))
    for (const s of ['open', 'under_review', 'resolved', 'closed']) {
      assert.ok(caseStatuses.has(s), `Must cover case status ${s}`)
    }
    const caseKinds = new Set(dbState.cases.map((c) => c.kind))
    assert.ok(caseKinds.has('missing') && caseKinds.has('found'), 'Must cover both missing and found case kinds')

    // Verify some cases have estimated_age
    const estimatedAgeCases = dbState.cases.filter((c) => c.estimated_age !== null)
    assert.ok(estimatedAgeCases.length >= 2, 'Must have cases with estimated_age')

    // Verify case_updates (several per case)
    assert.ok(dbState.case_updates.length >= 20, 'Must have multiple case updates')

    // Verify ~20 Reports (25 seeded)
    assert.equal(dbState.reports.length, 25, 'Must have ~20 reports (seeded 25)')
    const reportStatuses = new Set(dbState.reports.map((r) => r.status))
    for (const s of ['submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'closed']) {
      assert.ok(reportStatuses.has(s), `Must cover report status ${s}`)
    }
    const reportPriorities = new Set(dbState.reports.map((r) => r.priority))
    for (const p of ['low', 'normal', 'high', 'urgent']) {
      assert.ok(reportPriorities.has(p), `Must cover report priority ${p}`)
    }

    // Verify assigned vs unassigned reports
    const assigned = dbState.reports.filter((r) => r.assigned_officer_id !== null)
    const unassigned = dbState.reports.filter((r) => r.assigned_officer_id === null)
    assert.ok(assigned.length > 0, 'Must have assigned reports')
    assert.ok(unassigned.length > 0, 'Must have unassigned reports')

    // Verify 5 Matches
    assert.equal(dbState.matches.length, 5, 'Must have 5 matches')
    const matchStatuses = new Set(dbState.matches.map((m) => m.status))
    for (const s of ['pending', 'confirmed', 'dismissed']) {
      assert.ok(matchStatuses.has(s), `Must cover match status ${s}`)
    }

    // Verify match kind rules hold
    for (const match of dbState.matches) {
      assert.equal(match.missing_kind, 'missing')
      assert.equal(match.found_kind, 'found')
      const missingCase = dbState.cases.find((c) => c.case_id === match.missing_case_id)
      const foundCase = dbState.cases.find((c) => c.case_id === match.found_case_id)
      assert.equal(missingCase.kind, 'missing', 'Missing side must be missing case')
      assert.equal(foundCase.kind, 'found', 'Found side must be found case')
    }

    // Verify verifications recorded by officers
    assert.ok(dbState.match_verifications.length >= 2, 'Verifications must be recorded')

    // Verify Credentials CSV
    const credsContent = fs.readFileSync(testCredentialsPath, 'utf8')
    assert.ok(credsContent.includes('"role","name","email","password","badge_or_phone"'))
    assert.ok(credsContent.includes('"MockSecretPassword123!"'))

    // 2. Remove demo data
    const removeRes = await removeDemo({
      connection: mockConnection,
      manifestPath: testManifestPath,
      credentialsPath: testCredentialsPath,
      silent: true,
    })

    assert.equal(removeRes.success, true)
    assert.equal(fs.existsSync(testManifestPath), false, 'Manifest file should be removed')
    assert.equal(fs.existsSync(testCredentialsPath), false, 'Credentials file should be removed')
    assert.equal(dbState.officers.length, 0, 'All demo officers removed')
    assert.equal(dbState.cases.length, 0, 'All demo cases removed')
    assert.equal(dbState.case_updates.length, 0, 'All demo case updates removed')
    assert.equal(dbState.reports.length, 0, 'All demo reports removed')
    assert.equal(dbState.report_history.length, 0, 'All demo report history removed')
    assert.equal(dbState.matches.length, 0, 'All demo matches removed')
    assert.equal(dbState.match_verifications.length, 0, 'All demo match verifications removed')
    assert.equal(dbState.users.length, 0, 'All demo users removed')
  })
})

describe('Demo Seeder & Safety Integration Tests (identarchive_test)', { skip: skipReason }, () => {
  const connection = readiness.connection
  const testManifestPath = path.join(BACKEND_DIR, 'db-demo-manifest.json')
  const testCredentialsPath = path.join(BACKEND_DIR, 'db-demo-credentials.csv')

  before(async () => {
    for (const p of DEFAULT_FALLBACK_PINCODES) {
      await connection.execute(
        'INSERT IGNORE INTO pincodes (pincode, city, district, state) VALUES (?, ?, ?, ?)',
        [p.pincode, p.city, p.district, p.state]
      )
    }
  })

  after(async () => {
    if (fs.existsSync(testManifestPath)) fs.unlinkSync(testManifestPath)
    if (fs.existsSync(testCredentialsPath)) fs.unlinkSync(testCredentialsPath)
    if (connection) {
      await connection.end()
    }
  })

  beforeEach(async () => {
    if (fs.existsSync(testManifestPath)) fs.unlinkSync(testManifestPath)
    if (fs.existsSync(testCredentialsPath)) fs.unlinkSync(testCredentialsPath)
    await truncateTables(connection)

    for (const p of DEFAULT_FALLBACK_PINCODES) {
      await connection.execute(
        'INSERT IGNORE INTO pincodes (pincode, city, district, state) VALUES (?, ?, ?, ?)',
        [p.pincode, p.city, p.district, p.state]
      )
    }
  })

  it('live DB: seeds counts, checks statuses and kinds, and restores DB with --remove', async () => {
    const existingAdminId = '88888888-8888-8888-8888-888888888888'
    await connection.execute(
      `INSERT INTO users (user_id, name, email, password_hash, role, created_at, updated_at)
       VALUES (?, 'Super Admin', 'superadmin@identarchive.gov', '$2a$12$00000000000000000000000000000000000000000000000000000', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [existingAdminId]
    )

    await seedDemo({
      connection,
      manifestPath: testManifestPath,
      credentialsPath: testCredentialsPath,
      silent: true,
      database: testDbName,
    })

    const [officers] = await connection.query('SELECT * FROM officers ORDER BY badge ASC')
    assert.equal(officers.length, 7)
    assert.equal(officers.filter((o) => o.active === 1).length, 6)
    assert.equal(officers.filter((o) => o.active === 0).length, 1)

    const [users] = await connection.query("SELECT * FROM users WHERE role = 'individual'")
    assert.equal(users.length, 20)

    const [reports] = await connection.query('SELECT * FROM reports')
    assert.equal(reports.length, 25)

    const [cases] = await connection.query('SELECT * FROM cases')
    assert.equal(cases.length, 10)

    const [matches] = await connection.query('SELECT * FROM matches')
    assert.equal(matches.length, 5)

    // Remove demo and verify clean restoration
    await removeDemo({
      connection,
      manifestPath: testManifestPath,
      credentialsPath: testCredentialsPath,
      silent: true,
      database: testDbName,
    })

    const [remainingUsers] = await connection.query('SELECT * FROM users')
    assert.equal(remainingUsers.length, 1)
    assert.equal(remainingUsers[0].user_id, existingAdminId)
  })
})

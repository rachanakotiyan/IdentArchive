/**
 * auth.test.js
 *
 * Integration tests for M1–M4:
 *   - register ignores role field → always 'individual'
 *   - duplicate email → 409
 *   - login success / failure → identical error bodies
 *   - /me never returns password_hash
 *   - deactivated officer → 401 on authenticated routes
 *   - individual → 403 on admin routes
 *   - staff creation rolls back when the officers insert fails
 *   - create-admin refuses when an admin already exists (service layer test)
 *
 * Runs against DB_TEST_NAME (default identarchive_test).
 * Skips gracefully if the test DB is unreachable.
 */

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'
import {
  checkTestDbReadiness,
  truncateTables,
  createUser,
  createOfficer,
  DEFAULT_TEST_DB,
  validateTestDbName,
} from './helpers/test-db.js'
import * as userRepo from '../src/repositories/userRepository.js'
import * as officerRepo from '../src/repositories/officerRepository.js'
import * as authService from '../src/services/authService.js'
import { signToken, verifyToken } from '../src/utils/token.js'
import { createAdminUser } from '../scripts/create-admin.js'

// ---------------------------------------------------------------------------
// Fail-fast guard
// ---------------------------------------------------------------------------
const testDbName = process.env.DB_TEST_NAME || DEFAULT_TEST_DB
validateTestDbName(testDbName)

const readiness = await checkTestDbReadiness()
const skipReason = readiness.ok ? false : (readiness.reason || 'Test database unreachable')

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function startServer() {
  const server = app.listen(0)
  return new Promise((resolve) => server.once('listening', () => {
    const port = server.address().port
    resolve({ server, baseUrl: `http://127.0.0.1:${port}` })
  }))
}

async function stopServer(server) {
  return new Promise((resolve) => server.close(resolve))
}

function uid() { return crypto.randomUUID() }

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Auth & Staff API (M1–M4)', { skip: skipReason }, () => {
  let server, baseUrl, testConn

  before(async () => {
    ;({ server, baseUrl } = await startServer())
    testConn = readiness.connection
  })

  after(async () => {
    if (server) await stopServer(server)
    if (testConn) await testConn.end()
    await closePool()
  })

  beforeEach(async () => {
    if (testConn) await truncateTables(testConn)
  })

  // -------------------------------------------------------------------------
  // POST /api/auth/register
  // -------------------------------------------------------------------------
  describe('POST /api/auth/register', () => {
    it('creates a new individual user and returns token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: `jane-${uid()}@test.local`,
          password: 'password12345',
        }),
      })
      assert.equal(res.status, 201)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.ok(body.data.token)
      assert.equal(body.data.user.role, 'individual')
      assert.equal(body.data.user.password_hash, undefined, 'password_hash must not be returned')
      assert.equal(verifyToken(body.data.token).sub, body.data.user.user_id)
    })

    it('ignores a role field in the body – role is always individual', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Hacker Joe',
          email: `hacker-${uid()}@test.local`,
          password: 'password12345',
          role: 'admin',          // <── must be ignored
        }),
      })
      assert.equal(res.status, 201)
      const body = await res.json()
      assert.equal(body.data.user.role, 'individual')
    })

    it('returns 409 on duplicate email (case-insensitive)', async () => {
      const email = `dup-${uid()}@test.local`
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'First', email, password: 'password12345' }),
      })
      // Attempt registration with UPPER CASE variant
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Second', email: email.toUpperCase(), password: 'password12345' }),
      })
      assert.equal(res.status, 409)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error.code, 'EMAIL_CONFLICT')
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------------
  describe('POST /api/auth/login', () => {
    it('limits repeated attempts for the same IP and email', async () => {
      const email = `rate-${uid()}@test.local`
      let finalResponse
      for (let attempt = 0; attempt < 11; attempt += 1) {
        finalResponse = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: '' }),
        })
      }
      assert.equal(finalResponse.status, 429)
    })

    it('returns 200 + token on correct credentials', async () => {
      const email = `login-ok-${uid()}@test.local`
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'LoginUser', email, password: 'correctPass123' }),
      })
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'correctPass123' }),
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.ok(body.data.token)
      assert.equal(body.data.user.password_hash, undefined, 'password_hash must not appear in login response')
    })

    it('wrong-password and no-such-email produce identical error bodies', async () => {
      const email = `real-${uid()}@test.local`
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'RealUser', email, password: 'correctPass123' }),
      })

      const wrongPass = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrongPass000' }),
      })
      const noUser = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `ghost-${uid()}@test.local`, password: 'anyPassword' }),
      })

      assert.equal(wrongPass.status, 401)
      assert.equal(noUser.status, 401)

      const wpBody = await wrongPass.json()
      const nuBody = await noUser.json()

      assert.deepEqual(wpBody, nuBody)
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------------------------
  describe('GET /api/auth/me', () => {
    it('returns profile without password_hash for a valid token', async () => {
      const email = `me-${uid()}@test.local`
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Me User', email, password: 'mePass123' }),
      })
      const { data: { token } } = await regRes.json()

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.data.user.password_hash, undefined)
      assert.ok(body.data.user.id)
      assert.ok(body.data.user.name)
      assert.ok(body.data.user.email)
      assert.ok(body.data.user.role)
      assert.equal(body.data.user.phone, null)
    })

    it('returns 401 for an unauthenticated request', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`)
      assert.equal(res.status, 401)
    })
  })

  // -------------------------------------------------------------------------
  // Deactivated officer is rejected on authenticated routes
  // -------------------------------------------------------------------------
  describe('Deactivated officer rejection (M3)', () => {
    it('returns 401 for a deactivated officer token on GET /api/auth/me', async () => {
      // Create a user row (officer role) + officer row (active=0) directly in test DB
      const userId = uid()
      await createUser(testConn, {
        userId,
        email: `officer-deact-${uid()}@test.local`,
        role: 'officer',
      })
      await createOfficer(testConn, { userId, badge: `B-${uid().slice(0, 8)}`, active: 0 })

      const token = signToken({ userId, role: 'officer' })
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(res.status, 401)
      const body = await res.json()
      assert.equal(body.error.code, 'ACCOUNT_DEACTIVATED')
    })
  })

  // -------------------------------------------------------------------------
  // Admin routes blocked for non-admins
  // -------------------------------------------------------------------------
  describe('Admin routes – role enforcement (M4)', () => {
    it('returns 403 for individual user on POST /api/admin/staff', async () => {
      const email = `ind-${uid()}@test.local`
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'IndUser', email, password: 'indPass123' }),
      })
      const { data: { token } } = await regRes.json()

      const res = await fetch(`${baseUrl}/api/admin/staff`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'StaffUser', email: `s-${uid()}@test.local`,
          password: 'staffPass123', role: 'officer',
          badge: 'B-00X', district: 'Central',
        }),
      })
      assert.equal(res.status, 403)
    })

    it('uses the database role instead of an admin role in the token', async () => {
      const userId = uid()
      await createUser(testConn, {
        userId,
        email: `forged-admin-${uid()}@test.local`,
        role: 'individual',
      })
      const token = signToken({ userId, role: 'admin' })

      const res = await fetch(`${baseUrl}/api/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(res.status, 403)
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/staff – transactional rollback
  // -------------------------------------------------------------------------
  describe('POST /api/admin/staff (M4)', () => {
    async function makeAdminToken() {
      // Insert admin directly in test DB, then sign a token
      const adminId = uid()
      await createUser(testConn, { userId: adminId, role: 'admin', email: `admin-${uid()}@test.local` })
      return signToken({ userId: adminId, role: 'admin' })
    }

    it('creates officer user and officers row when inputs are valid', async () => {
      const token = await makeAdminToken()
      const email = `staff-${uid()}@test.local`
      const badge = `BADGE-${uid().slice(0, 6)}`

      const res = await fetch(`${baseUrl}/api/admin/staff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Officer One', email, password: 'officerPass123',
          role: 'officer', badge, district: 'East District',
        }),
      })
      assert.equal(res.status, 201)
      const body = await res.json()
      assert.equal(body.data.user.role, 'officer')
      assert.equal(body.data.officer.badge, badge)
      assert.equal(body.data.user.password_hash, undefined)
    })

    it('rolls back fully when badge is duplicated (officers insert fails)', async () => {
      const token = await makeAdminToken()
      const badge = `UNIQ-${uid().slice(0, 6)}`
      const email1 = `staff1-${uid()}@test.local`
      const email2 = `staff2-${uid()}@test.local`

      // First insertion succeeds
      await fetch(`${baseUrl}/api/admin/staff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'First', email: email1, password: 'officerPass123',
          role: 'officer', badge, district: 'West',
        }),
      })

      // Count users before second attempt
      const [before] = await testConn.query('SELECT COUNT(*) AS n FROM users')

      // Second attempt reuses same badge → officers INSERT should fail → whole tx rolls back
      const res = await fetch(`${baseUrl}/api/admin/staff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Second', email: email2, password: 'officerPass123',
          role: 'officer', badge, district: 'East',
        }),
      })
      assert.ok(res.status === 409, `Expected 409, got ${res.status}`)

      // Verify user row was NOT left behind (transaction rolled back)
      const [after] = await testConn.query('SELECT COUNT(*) AS n FROM users')
      assert.equal(before[0].n, after[0].n, 'No user row should have been committed on rollback')
    })

    it('lists staff without password hashes and deactivates officers', async () => {
      const token = await makeAdminToken()
      const userId = uid()
      await createUser(testConn, {
        userId,
        email: `listed-officer-${uid()}@test.local`,
        role: 'officer',
      })
      const officer = await createOfficer(testConn, {
        userId,
        badge: `LIST-${uid().slice(0, 8)}`,
      })

      const listResponse = await fetch(`${baseUrl}/api/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(listResponse.status, 200)
      const listBody = await listResponse.json()
      assert.ok(listBody.data.staff.some((staff) => staff.role === 'admin'))
      assert.ok(listBody.data.staff.some((staff) => staff.user_id === userId && staff.role === 'officer'))
      assert.equal(JSON.stringify(listBody).includes('password_hash'), false)

      const deactivateResponse = await fetch(`${baseUrl}/api/admin/staff/${officer.officer_id}/active`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: 'false' }),
      })
      assert.equal(deactivateResponse.status, 400)

      const validDeactivateResponse = await fetch(`${baseUrl}/api/admin/staff/${officer.officer_id}/active`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: false }),
      })
      assert.equal(validDeactivateResponse.status, 200)

      const officerToken = signToken({ userId, role: 'officer' })
      const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${officerToken}` },
      })
      assert.equal(meResponse.status, 401)
    })

    it('refuses to let a public caller gain officer/admin role via register', async () => {
      // register endpoint always forces 'individual'
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Evil User', email: `evil-${uid()}@test.local`,
          password: 'evilPass123', role: 'officer',
        }),
      })
      const body = await res.json()
      assert.equal(body.data.user.role, 'individual')
    })
  })

  // -------------------------------------------------------------------------
  // create-admin service layer: refuse when admin exists
  // -------------------------------------------------------------------------
  describe('adminExists guard (M1)', () => {
    it('userRepo.adminExists returns false when no admins exist', async () => {
      const exists = await userRepo.adminExists()
      assert.equal(exists, false)
    })

    it('userRepo.adminExists returns true after an admin is inserted', async () => {
      await createUser(testConn, { role: 'admin', email: `admin2-${uid()}@test.local` })
      const exists = await userRepo.adminExists()
      assert.equal(exists, true)
    })

    it('create-admin refuses to create another admin', async () => {
      await createUser(testConn, { role: 'admin', email: `existing-admin-${uid()}@test.local` })

      await assert.rejects(
        () => createAdminUser({
          name: 'Second Admin',
          email: `new-admin-${uid()}@test.local`,
          password: 'long-enough-password',
        }),
        (error) => error.name === 'AdminExistsError'
      )
    })

    it('create-admin requires a password of at least 12 characters', async () => {
      await assert.rejects(
        () => createAdminUser({
          name: 'Short Password',
          email: `short-${uid()}@test.local`,
          password: 'short-pass',
        }),
        (error) => error.name === 'AdminInputError'
      )
    })

    it('authService.createStaff throws 409 on duplicate email', async () => {
      const email = `dup2-${uid()}@test.local`
      await createUser(testConn, { email, role: 'individual' })

      await assert.rejects(
        () => authService.createStaff({
          name: 'Dup Staff', email, password: 'staffPass123',
          role: 'officer', badge: `B-${uid().slice(0, 6)}`, district: 'North',
        }),
        (err) => {
          assert.equal(err.statusCode, 409)
          assert.equal(err.code, 'EMAIL_CONFLICT')
          return true
        }
      )
    })
  })
})
